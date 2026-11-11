from pathlib import Path
import re,json
from pypdf import PdfReader
SOURCE=Path(r'C:\Users\zjt\xwechat_files\wxid_q83q70mrbgo711_976b\msg\file\2026-11\Book Voc\Book Voc\Book Reading Vocabulary')
OUT=Path('output/question-banks'); OUT.mkdir(parents=True,exist_ok=True)
key={}
for page in PdfReader(SOURCE/'LG-V-RV-G.pdf').pages:
 for line in page.extract_text().splitlines():
  m=re.fullmatch(r'\s*(\d+)\s+([a-d\s]+)',line)
  if m:
   answers=m[2].split()
   if len(answers)==12:key[int(m[1])]=[ord(a)-97 for a in answers]
assert len(key)==30
raw_text='\n'.join(p.read_text(encoding='utf-8') for p in Path('tmp/pdfs').glob('Reading Vocabulary *.txt'))
lexicon=set(re.findall(r'\b[a-zA-Z]{3,}\b',raw_text.lower()))
whole_words=set('of if off half self himself herself itself myself yourself from him them room warm form storm arm farm firm team seem dream cream swim calm term charm alarm perform uniform'.split())

def clean(s):
 s=s.replace('\ufffd\ufffd',"'").replace('\ufffdC','-')
 s=re.sub(r'(?<=\S)[ \t]{3,}(?=\S)',' _____ ',s)
 s=re.sub(r'\s+',' ',s).strip()
 def repair(m):
  left,right=m.groups(); joined=left+right
  return joined if left.lower() not in whole_words and joined.lower() in lexicon else m[0]
 return re.sub(r'\b([A-Za-z]*[mf]) ([a-z]+)\b',repair,s)
report=[]
for file in sorted(SOURCE.glob('Reading*.pdf')):
 level=file.stem.split()[-1].lower()
 text=Path('tmp/pdfs',file.stem+'.txt').read_text(encoding='utf-8')
 # Remove page furniture before joining multi-page questions.
 text=re.sub(r'The Learning Gate[^\n]*','',text)
 text=re.sub(r'(?m)^\s*'+re.escape(level)+r'\d+-\d+\s*$','',text,flags=re.I)
 starts=list(re.finditer(r'(?im)^\s*('+re.escape(level)+r'(\d+))\s+(.+?)(?=\s+Name\s+Date\s+LG-V-RV-|\n)',text))
 # Locate full title using the stable Name / Date header, including wrapped titles.
 starts=list(re.finditer(r'(?im)^\s*('+re.escape(level)+r'(\d+))\s+([\s\S]*?)Name\s+Date\s+LG-V-RV-'+re.escape(level),text))
 worksheets=[]; issues=[]
 for wi,h in enumerate(starts):
  body=text[h.end():starts[wi+1].start() if wi+1<len(starts) else len(text)]
  code=h[1].lower(); title=clean(h[3]); section=''; questions=[]
  tokens=list(re.finditer(r'(?im)^\s*((?:FIND THE [A-Z ]+|CO[MP]+LETE THE SENTENCE)|\d+\s*\.?\s*(?=[A-Za-z"\ufffd]))',body))
  # Question starts are numbered lines; choices a-d are split independently.
  body=re.sub(r'(?m)^b    gather', 'b. gather', body)
  body=re.sub(re.escape(level)+r'\d+-\d+','',body,flags=re.I)
  body=re.sub(r'(?m)^(\s*d) occationally', r'\1. occationally', body)
  body=body.replace('1. 28. Watch','28. Watch')
  body=re.sub(r'(?m)^(\s*5) slender',r'\1. slender',body)
  qm=list(re.finditer(r'(?m)^\s*(\d+)(?:\.[ \t]*|[ \t]+)(?!different homework|[:\d])(?=\S)',body))
  for qi,m in enumerate(qm):
   n=int(m[1]); chunk=body[m.end():qm[qi+1].start() if qi+1<len(qm) else len(body)]
   chunk=re.split(r'FIND THE [A-Z ]+|CO[MP]+LETE THE SENTENCE',chunk)[0]
   cm=list(re.finditer(r'(?m)(?:^|(?<=\s))([a-e])\.\s*',chunk))
   if code=='2a6' and n==15:
    chunk=chunk[:cm[4].start()]; cm=cm[:4]
   if len(cm)!=4:
    issues.append({'worksheet':code,'question':n,'error':'choice parsing','labels':[c[1] for c in cm]});continue
   prompt=clean(chunk[:cm[0].start()])
   if not prompt:prompt='Find the correct spelling.'
   elif n>(10 if level[0] not in '23' else 5) and n<=(20 if level[0] not in '23' else 10):prompt='Find the correct spelling. '+prompt
   choices=[clean(chunk[c.end():cm[j+1].start() if j+1<4 else len(chunk)]) for j,c in enumerate(cm)]
   answer=key[n][(int(h[2])-1)%12]
   if code=='3a1' and n==1:answer=0
   if code=='2a6' and n==1:answer=0
   if code=='4b1' and n==10:answer=0
   if code=='3c25':answer=[0,2,3,1,2,0,3,1,1,2,3,1,2,0,3][n-1]
   questions.append({'prompt':prompt,'choices':choices,'correct_index':answer})
  expected=15 if level[0] in '23' else 30
  if len(questions)!=expected:issues.append({'worksheet':code,'expected':expected,'actual':len(questions)})
  # Check spelling answers against the vocabulary explicitly introduced in this worksheet.
  size=5 if level[0] in '23' else 10
  compact=lambda value:re.sub(r'[^a-z]','',value.lower())
  vocabulary=[]
  for q in questions[:size]:
   word=re.split(r'\b(?:means?|is|are)\b',q['prompt'])[0].strip()
   word=re.sub(r'^(?:a|an|to be)\s+','',word,flags=re.I)
   vocabulary.append(compact(word))
  spelling=[]
  for ix,q in enumerate(questions[size:size*2],start=size+1):
   matches=[j for j,c in enumerate(q['choices']) if compact(c) in vocabulary]
   if len(matches)==1:q['correct_index']=matches[0]
   elif len(matches)!=1:spelling.append({'question':ix,'reason':'Spelling requires review','matches':matches})
  if spelling:issues.extend({'worksheet':code,**item} for item in spelling)
  worksheets.append({'code':code,'title_zh':'','title_en':title,'grade':'G'+level[0] if level[0].isdigit() else '', 'questions':questions})
 suffix=''
 (OUT/f'reading-vocabulary-{level}{suffix}.json').write_text(json.dumps({'worksheets':worksheets},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 report.append({'volume':level,'worksheets':len(worksheets),'questions':sum(len(w['questions']) for w in worksheets),'issues':issues,'answers':'Provisional: shared answer-position pattern from LG-V-RV-G.pdf; spelling checked against worksheet vocabulary; all answers require review. 3a1 Q1 corrected by meaning.','review_required':True})
(OUT/'extraction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

