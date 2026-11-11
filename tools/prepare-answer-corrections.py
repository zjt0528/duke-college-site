from pathlib import Path
import json,csv
rows=['dbbcabccdcacdac','bacdbcacacddcba','cabdbcdccabcbad','dcabdcbdacdbacb','acdbcadbbcdbcad','cabddbbcabdabbd','bdcabacdbcdbdac','abcdcabdbcabcdb','bdccdcabdcbabca','dbacacdbcaddacb','badccabdcadcbda','cdbcadbcd aacbbd'.replace(' ','')]
assert all(len(r)==15 for r in rows)
out=Path('output/answer-corrections');out.mkdir(parents=True,exist_ok=True)
summary=[]
for level in ['2a','2b']:
 p=Path(f'output/question-banks/reading-vocabulary-{level}.json');data=json.loads(p.read_text(encoding='utf-8'))
 patches=[]
 for ws in data['worksheets']:
  n=int(ws['code'][2:])
  # User confirmed 25/26 in image are typos for 16/21.
  answers=rows[(n-1)%12]
  assert len(ws['questions'])==len(answers)
  for i,(q,a) in enumerate(zip(ws['questions'],answers),1):
   new=ord(a)-97
   if new!=q['correct_index']:summary.append([level,ws['code'],i,chr(q['correct_index']+65),a.upper()])
   q['correct_index']=new
  patches.append({'code':ws['code'],'answers':answers.upper()})
 (out/f'{level}-answer-key.json').write_text(json.dumps({'worksheets':patches},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (out/f'reading-vocabulary-{level}-corrected.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (out/'changes.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['级别','练习','题号','本地旧答案','答案表新答案']);w.writerows(summary)
(out/'README.md').write_text('本文件夹按用户提供的 2a/2b 答案图片转录。用户已确认：2a 图片中的 25/26 为笔误，已按 16/21 处理。\n*-answer-key.json 是已有题目的批量改答案文件，不是新增题目导入文件。\n*-corrected.json 是完整题目 JSON，仅供备份或导入到新题库，不要向原题库重复导入。\nchanges.csv 比较的是本地旧 JSON，不代表线上实际差异。尚未修改线上数据库。\n',encoding='utf-8')
print('Local answer changes:',len(summary),'applied key questions:',48*15)

