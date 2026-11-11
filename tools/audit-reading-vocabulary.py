from pathlib import Path
import json,csv,re,hashlib,collections
OUT=Path('output/answer-audit');OUT.mkdir(parents=True,exist_ok=True)
issues=[]
def add(code,n,kind,level,reason,suggestion,source=''):
 issues.append(dict(worksheet=code,question=n,category=kind,severity=level,reason=reason,suggestion=suggestion,source=source))
add('3a5',15,'答案错误','优先修正','句子 She ___ her son because he did not listen to her. 当前 D=wicked 无法作所需过去式动词。','答案 D 改 B=scolded。')
add('3a1',1,'答案与书中语境不符','优先修正','browsed 在本练习长颈鹿吃树叶语境中是取食；当前 D=looked for 不符合这个义项。browse 也有浏览/随意查看义，建议把语境写进题干。','答案建议 D 改 A=fed on，并明确题干为 In the story, browsed means...。','https://animals.sandiegozoo.org/animal-glossary/browse')
add('3c16',3,'释义选项不准确','优先修正','several 不等于当前 A=many；B=few 也不如 a few/some 准确，不建议只机械换答案。','将 A 改为 more than two but not many，保留答案 A；或重写选项后重新确定答案。','https://dictionary.cambridge.org/us/dictionary/english/several?topic=different-and-difference')
add('2c2',8,'拼写题多解','优先修正','C=pinch 和 D=unusual 均拼写正确。原 PDF 第四个标签印成 e，JSON 按第四项处理。','保留 C，第四项改成明确错拼 unusuall。')
add('2c12',7,'拼写题多解','优先修正','A=paddler 是合法英语单词，B=cleverness 也正确；若题目仅问正确拼写，不能唯一选 B。','保留 B，将 A 改为不构成另一合法词的错拼，例如 peddlerr；或明确限定为本课词表中的正确拼写。','https://dictionary.cambridge.org/dictionary/english/paddler')
add('3b4',1,'缺少准确释义','优先修正','healing 指使恢复健康/愈合，D=saving 不能准确释义，其余选项也不合适。','把 D 改为 making or becoming healthy again，保留 D。','https://dictionary.cambridge.org/us/dictionary/english/heal')
add('3a19',2,'缺少准确释义','优先修正','crumpled 是弄皱/揉成一团，D=destroyed 过强，纸揉皱不等于被毁掉，其余也不合适。','把 D 改为 crushed into wrinkles or folds，保留 D。')
add('3c3',5,'缺少准确释义','优先修正','lame 的身体义项指腿脚受伤导致行走困难；B=weak 不准确，其他选项也不准确。','把 B 改为 unable to walk properly because of an injured leg or foot。','https://www.collinsdictionary.com/dictionary/english/lame')
add('3c3',12,'例句义项不合适','优先修正','以翅膀受伤、飞得低来说明 lame，不是其标准腿脚行走义。','改写为 The dog was ____ because its leg was hurt.，仍选 C=lame。')
add('3b3',13,'原稿缺少填空','优先修正','当前句子完整写成 The bird looked out from the cage with its eyes.，没有空格；已查看原 PDF 页面，原稿也如此。','改成 The bird looked out from the cage with its _____ eyes.，保留 B=fierce。')
add('2c2',15,'提取多出填空','优先修正','句号后版式空白被误识别为填空，当前有两个空。原 PDF 只在 very 后留空。','删除 wrong with him. 与 He looks 之间多出的 _____，保留 very 后的空与答案 A。')
add('2c5',14,'提取多出填空','优先修正','Watch out! 与 A ... man 之间的句间排版空白被误识别成填空。','改成 Watch out! A _____ man is coming.，保留 A=strange。')
add('3b1',12,'句子语境多解风险','建议明确','The magician ___ the audience with his skills. 中 C=flabbergasted 合理；D=duped 也可能表示魔术师用技巧骗过观众，句子没有排除。','增加惊讶线索，例如 The audience was completely amazed; the magician _____ them with his skills. 保留 C。')
add('3b9',2,'释义近义重叠','建议明确','fond 选 D=to like，但 C=to enjoy 语义非常接近；脱离 fond of 的搭配时不够唯一。','改成 fond of means，并把 C 换成 to avoid，保留 D=to like。')
add('3b11',2,'多义词未限定语境','建议明确','fluttered 可以指轻轻摆动，也可以指快速轻盈地飞；A=waved lightly 与 B=flew around 都有可辩护的义项。','限定为 The flags fluttered in the wind. 中的意思，或替换 B。','https://dictionary.cambridge.org/us/dictionary/learner-english/flutter')
add('3b11',5,'英美词义导致多解','建议明确','C=being cheap 是预期答案，但 B=being mean 在英式英语中也可指吝啬、不慷慨。','把 B 换成 being careless，保留 C；也可把 C 改成 unwilling to share or spend money。','https://dictionary.cambridge.org/dictionary/english/mean?q=mean_2')
add('3c19',8,'旧拼写变体风险','建议明确','B=bowlder 在旧词典中是 boulder 的变体；D=pleaded 为现代预期答案。不是常用现代拼写，但作绝对错误项容易产生争议。','把 B 换成明显错拼 bouulder，保留 D；不将旧式拼写当成普通错字。','https://ttabvue.uspto.gov/ttabvue/ttabvue-91190282-OPP-38.pdf')
add('2c2',2,'释义建议','文字优化','draw the drapes 指拉上/拉开窗帘，A=pull down 不够准确。','把 A 改为 pull the curtains open or closed，并在题干说明 curtains 语境。')
add('2c5',2,'比较级释义建议','文字优化','dirtier 是 more dirty，C=very dirty 没有体现比较级。','将 C 改为 more dirty，保留 C。')
add('2c10',3,'释义建议','文字优化','shame 可指羞愧/耻辱/遗憾；A=feeling sorry 过宽，例句用法也可能是遗憾而不是羞愧。','限定羞愧义并将 A 改为 an unhappy feeling about having done something wrong，或改用 What a shame 的遗憾语境。')
add('2c16',4,'释义建议','文字优化','foolishly 是愚蠢地、不明智地，B=carelessly 仅近似。','将 B 改为 unwisely。')
add('2c18',5,'释义建议','文字优化','thumping 是重重地敲/砰砰作响，D=tapping 通常轻敲，力度不同。','将 D 改为 hitting or beating heavily。')
add('2c19',5,'释义建议','文字优化','canning 是加热密封保存食物，家庭场景也可用玻璃瓶，不只是往罐中放。','将 B 改为 preserving food in sealed cans or jars。')
add('2c21',2,'释义建议','文字优化','dazzling 不只泛指 wonderful，核心为耀眼/令人赞叹。','将 D 改为 extremely bright or impressive。')
add('2c22',5,'释义建议','文字优化','rabbi 是犹太教宗教领袖/教师，不是泛指任何给建议的人。','将 A 改为 a Jewish religious teacher or leader。')
add('2c23',2,'释义建议','文字优化','wick 指灯芯/烛芯，并非泛指蜡烛顶部。','将 A 改为 the string in a candle that burns。')
add('2c24',1,'释义建议','文字优化','coincidence 不只是同时发生，还强调偶然且看似有关联。','将 C 改为 two similar or connected events happening by chance。')
add('3a3',3,'释义建议','文字优化','mumbled 侧重说得含糊、不清楚，B=spoke with a low voice 只说明音量。','将 B 改为 spoke quietly and unclearly。')
add('3a5',5,'释义建议','文字优化','河岸义的 bank 是沿河的陆地，C=by the river 是位置短语，不是名词释义。','将 C 改为 the land along the side of a river。')
add('3a7',3,'释义建议','文字优化','inspected 是仔细检查；C=looked around 太泛。','将 C 改为 examined carefully。')
add('3a15',5,'释义建议','文字优化','recited 是背诵或朗诵，B=read out 不一定体现记忆背诵义。','将 B 改为 said aloud from memory。')
add('3a18',3,'释义建议','文字优化','climate 指长期气候特征，不等同短期 weather。','将 B 改为 the usual weather conditions of a place over many years。')
add('3a18',4,'释义建议','文字优化','expert 是知识/技能熟练的人，不只 a talented person。','将 D 改为 a person with special knowledge or skill。')
add('3a22',1,'释义建议','文字优化','stool 通常无靠背，D=chair 太宽泛。','将 D 改为 a seat without a back。')
add('3a23',5,'释义近义重叠','建议明确','C=delicate 最贴近 dainty，但 D=pretty 也与该词的漂亮精巧义重叠。','将 D 换成 noisy，保留 C；或将 C 写成 small and delicate。')
add('3b3',1,'释义建议','文字优化','fierce 侧重凶猛/强烈，C=wild 只是近义。','将 C 改为 aggressive or powerful。')
add('3b4',2,'释义建议','文字优化','famine 是广泛的严重食物短缺，不是一般 hunger。','将 C 改为 a severe shortage of food。')
add('3b6',5,'释义建议','文字优化','intense 的 D=great 过宽。','将 D 改为 very strong or extreme。')
add('3b10',1,'释义建议','文字优化','brag 指夸耀地谈论自己，不仅是心里太骄傲。','将 D 改为 to talk too proudly about oneself。')
add('3b10',4,'释义建议','文字优化','ripe 在草莓语境指成熟可食，C=all grown 不够准确。','将 C 改为 fully developed and ready to eat。')
add('3b20',3,'释义建议','文字优化','tempted 是诱使/让人想做，不保证人实际去做；C=make a person do something 过强。','将 C 改为 made a person want to do something。')
add('3b22',5,'释义建议','文字优化','fade 是逐渐变淡/消失，A=wear out 不够对应。','将 A 改为 to become less bright or less clear。')
add('3c2',2,'词性与释义建议','文字优化','hardship 是名词；A=not easy 是形容性表述。','将 A 改为 a difficult or unpleasant situation。')
add('3c4',5,'释义建议','文字优化','ripe 在樱桃语境指成熟可食，D=fully grown 太宽。','将 D 改为 mature and ready to eat。')
add('3c10',3,'释义建议','文字优化','anxiously 可含担忧或急切期待，不宜简单教成 with excitement。','将 A 改为 in a worried or eager way。')
add('3c11',5,'释义建议','文字优化','brittle 的特点是容易碎裂，不是笼统 weak。','将 C 改为 hard but easily broken。')
add('3c14',1,'释义建议','文字优化','debated 可以是正式讨论、辩论，不一定 fought with words。','将 B 改为 discussed different opinions。')
add('3c14',2,'释义建议','文字优化','compromise 强调各方让步达成协议，不是任意 solve。','将 A 改为 to reach an agreement by each side giving up something。')
add('3c14',12,'例句搭配建议','文字优化','compromise over the matter 可以理解，但 compromise on the matter 更适合基础教学。','题干改为 Finally, Washington decided to _____ on the matter. 保留 D。')
add('3c21',4,'释义建议','文字优化','adore 强于 to like，表达非常喜爱。','将 C 改为 to love very much。')
add('3c24',3,'释义建议','文字优化','strumming 指扫拨弦，B=playing music 太泛。','将 B 改为 playing a stringed instrument by brushing the strings。')
add('3c24',11,'原题措辞错误','优先修正','chords 是和弦，不是供手指扫拨的琴弦；strum her fingers against the chords 的表达不合适。','题干改为 She was _____ the strings of the guitar with her fingers.，选 A；同时 A 的 s trumming 应合并。')
add('3c24',13,'例句搭配建议','文字优化','played in syncopation 可理解但不自然。','改为 Ragtime music often uses _____.，仍选 B=syncopation。')
# Explicitly reviewed extraction spacing in correct answers; do not "correct" intentionally misspelled distractors.
fixes={'self ish':'selfish','am used':'amused','st iff':'stiff','mo ment':'moment','scrum ptious':'scrumptious','am aze':'amaze','form ed':'formed','com fort':'comfort','r emembered':'remembered','m eetings':'meetings','c ompromise':'compromise','s trumming':'strumming'}
data_by_level={}
for lev in ['2c','3a','3b','3c']:
 path=Path(f'output/verified-answer-imports/reading-vocabulary-{lev}.json')
 data_by_level[lev]=json.loads(path.read_text(encoding='utf-8'))
 for ws in data_by_level[lev]['worksheets']:
  for n,q in enumerate(ws['questions'],1):
   candidate=q['choices'][q['correct_index']]
   matches=[(a,b) for a,b in fixes.items() if candidate==a]
   # Spelling questions are particularly affected by spaces inside the correct word.
   if matches:
    a,b=matches[0];add(ws['code'],n,'提取单词断开','排版修正',f'当前正确选项显示为 {a}，词内多出空格。',f'仅合并为 {b}，答案字母不变。')
   if ws['code']=='3c8' and n==1:add(ws['code'],n,'提取单词断开','排版修正','题干 e quipment 多出词内空格。','改为 equipment means，答案不变。')
   if ws['code']=='3a24' and n==4:add(ws['code'],n,'提取单词断开','排版修正','题干 scrum ptious 多出词内空格。','改为 scrumptious means，答案不变。')
# Create a per-question ledger: every question was read with all options, not simply index/format validated.
fields=['级别','练习','书名','题号','题目','A','B','C','D','当前答案','当前正确选项','本次核对结果','问题类别','说明','建议']
by_question=collections.defaultdict(list)
for item in issues:by_question[(item['worksheet'],item['question'])].append(item)
ledger=[]
for lev,data in data_by_level.items():
 for w in data['worksheets']:
  assert len(w['questions'])==15
  for n,q in enumerate(w['questions'],1):
   found=by_question[(w['code'],n)]
   ledger.append([lev,w['code'],w['title_en'],n,q['prompt'],*q['choices'],chr(65+q['correct_index']),q['choices'][q['correct_index']],
     '有问题或优化建议' if found else '逐题核对，未发现明确问题','；'.join(x['category'] for x in found),'；'.join(x['reason'] for x in found),'；'.join(x['suggestion'] for x in found)])
assert len(ledger)==1440
with (OUT/'all-1440-questions.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(fields);w.writerows(ledger)
with (OUT/'issues.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['练习','题号','类别','优先级','问题','建议','参考来源'])
 for x in issues:w.writerow([x[k] for k in ['worksheet','question','category','severity','reason','suggestion','source']])
(OUT/'issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2),encoding='utf-8')
summary={lev:{'reviewed':360,'flagged_questions':len({(x['worksheet'],x['question']) for x in issues if x['worksheet'].startswith(lev)})} for lev in data_by_level}
counts=collections.Counter(x['severity'] for x in issues)
lines=['# 2c、3a、3b、3c 逐题核对报告','',
 '核对版本：output/verified-answer-imports 中四册最终 JSON；3c 按用户确认使用 12/24 共用末行，3c17 为原3c25 Phoebe The Spy，24套。',
 '范围：96套练习、1,440道题。逐题读取题干、四个选项和当前答案，检查词义、常见拼写、句法语境、唯一答案与明显提取问题。已另行查看 2c2 和 3b3 的 PDF 原页以定位关键排版/原稿问题。',
 '界限：这不是另一个官方答案表，也不保证穷尽所有英语变体。未逐页视觉比对全部原 PDF，也未核对所有原著故事细节；其余答案的“未发现明确问题”是本次语言核对结论，不是绝对正确证明。原 JSON 与线上数据库均未因本次检查而修改。',
 '',f'共记录 {len(issues)} 条问题/建议，涉及 {len({(x["worksheet"],x["question"]) for x in issues})} 道题。同一道题可能既有原题问题又有提取排版问题。',
 '', '| 册别 | 已逐题核对 | 有问题或建议的题数 |','|---|---:|---:|']
for lev,s in summary.items():lines.append(f'| {lev} | 360 | {s["flagged_questions"]} |')
lines+=['','## 优先处理的问题','', '| 练习 | 题号 | 发现 | 建议 |','|---|---:|---|---|']
for x in issues:
 if x['severity']=='优先修正':lines.append(f'| {x["worksheet"]} | {x["question"]} | {x["reason"]} | {x["suggestion"]} |')
lines+=['','## 其他歧义与优化建议','']
for x in issues:
 if x['severity'] in ['建议明确','文字优化']:
  lines.append(f'- **{x["worksheet"]} 第{x["question"]}题（{x["category"]}）**：{x["reason"]} 建议：{x["suggestion"]}')
lines+=['','## 提取排版问题','',
 '正确选项中仍有词内断空格，例如 am used、st iff、form ed、scrum ptious、s trumming。完整位置见 issues.csv。拼写题尤其需要合并正确词的空格；干扰项中原本设计的错拼不可一概自动纠正。',
 '2c2 第15题、2c5 第14题多出的填空属于提取转换错误。3b3 第13题的填空遗漏则在原 PDF 中已经存在。',
 '', '## 文件说明','',
 '- all-1440-questions.csv：全部题目、选项、当前答案与逐题核对状态；UTF-8 BOM，可用 Excel 打开。',
 '- issues.csv / issues.json：仅问题题目与建议，包含来源链接。',
 '- 本次未更改题目导入文件、未更改数据库、未重算成绩。',
 '', '## 参考来源','']
for url in dict.fromkeys(x['source'] for x in issues if x['source']):lines.append('- '+url)
(OUT/'review-report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
(OUT/'summary.json').write_text(json.dumps({'total_reviewed':1440,'flagged_questions':len({(x['worksheet'],x['question']) for x in issues}),'issue_entries':len(issues),'categories':dict(counts),'volumes':summary},ensure_ascii=False,indent=2),encoding='utf-8')
print((OUT/'summary.json').read_text(encoding='utf-8'))
