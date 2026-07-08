/*
 * Duke College — site script (loaded with `defer`, so the DOM is ready).
 * Contents:
 *   1. Footer year stamp
 *   2. Service-detail modal (openModal/closeModal — called from inline onclick)
 *   3. Main IIFE: i18n translations, language switch, hash routing,
 *      partners carousel, office hours, dev-only i18n parity check
 *   4. Contact form -> Web3Forms submit handler
 */

/* 1. Stamp the current year into the footer's <span id="y">. */
document.getElementById('y').textContent = new Date().getFullYear();


    /* 2. Service-detail modal.
     *    Each key maps a service card to its popup image plus per-language
     *    title/HTML body ({ en, zh } — picked by the site language).
     *    openModal() is invoked from inline onclick="openModal('k12')" etc.,
     *    so these functions must stay global (do not wrap in an IIFE). */
    const modalData = {
      k12: {
        image: 'Images/K12.png',
        title: { en: 'K-12 Reading & Writing Program', zh: 'K-12 阅读与写作课程' },
        content: {
          en: '<p>Our comprehensive K-12 reading and writing program is designed to build strong foundations in literacy skills. With leveled instruction from kindergarten through grade 12, students develop fluency, comprehension, and expressive writing abilities.</p><p><strong>Key Features:</strong></p><ul><li>Phonics and early reading foundations</li><li>Guided reading for comprehension</li><li>Literary analysis and close reading</li><li>Academic essay writing</li><li>Public speaking integrated components</li></ul>',
          zh: '<p>我们系统的 K-12 阅读与写作课程旨在为孩子打下坚实的读写基础。课程从幼儿园到 12 年级分级教学，全面培养学生的阅读流利度、理解力和书面表达能力。</p><p><strong>课程特色：</strong></p><ul><li>自然拼读与早期阅读基础</li><li>引导式阅读理解</li><li>文学分析与精读</li><li>学术论文写作</li><li>融合公共演讲训练</li></ul>'
        }
      },
      esl: {
        image: 'Images/ESL.png',
        title: { en: 'ESL Course of Canada', zh: '加拿大 ESL 课程' },
        content: {
          en: '<p>Comprehensive English as a Second Language instruction tailored to students of all ages and proficiency levels.</p><p><strong>Programs Include:</strong></p><ul><li>Youth ESL - Interactive cultural programs</li><li>High School ESL - Academic vocabulary focus</li><li>Adult ESL - Workplace communication skills</li><li>Flexible scheduling and adaptive learning</li></ul>',
          zh: '<p>面向各年龄段、各水平学生的系统 ESL（英语作为第二语言）课程。</p><p><strong>课程包括：</strong></p><ul><li>青少年 ESL —— 互动文化课程</li><li>高中 ESL —— 学术词汇强化</li><li>成人 ESL —— 职场沟通技能</li><li>灵活排课，因材施教</li></ul>'
        }
      },
      tests: {
        image: 'Images/LanguageTest.png',
        title: { en: 'Language Test Preparation', zh: '语言考试备考课程' },
        content: {
          en: '<p>Specialized test preparation for major English proficiency exams.</p><p><strong>Tests Covered:</strong></p><ul><li>IELTS - Band improvement strategy</li><li>TOEFL - Academic English focus</li><li>CELPIP - Canadian immigration exam</li><li>Duolingo - Rapid improvement drills</li><li>Custom test prep available</li></ul>',
          zh: '<p>针对各大英语水平考试的专项备考课程。</p><p><strong>涵盖考试：</strong></p><ul><li>雅思（IELTS）—— 分数提升策略</li><li>托福（TOEFL）—— 学术英语强化</li><li>思培（CELPIP）—— 加拿大移民考试</li><li>多邻国（Duolingo）—— 快速提分训练</li><li>可定制个性化备考方案</li></ul>'
        }
      },
      ps: {
        image: 'Images/publicspeaking.png',
        title: { en: 'Public Speaking Course', zh: '公共演讲课程' },
        content: {
          en: '<p>Build confidence and presentation skills through structured public speaking instruction.</p><p><strong>Program Benefits:</strong></p><ul><li>Confidence building in front of audiences</li><li>Clarity and articulation development</li><li>Pronunciation improvement</li><li>Presentation structure and delivery</li><li>Q&A and panel discussion skills</li></ul>',
          zh: '<p>通过系统的公共演讲训练，建立自信、提升表达能力。</p><p><strong>课程收获：</strong></p><ul><li>培养面对听众的自信</li><li>提升表达清晰度与口齿</li><li>改善发音</li><li>演讲结构与台风训练</li><li>问答与小组讨论技巧</li></ul>'
        }
      },
      math: {
        image: 'Images/Math.png',
        title: { en: 'Math Course', zh: '数学课程' },
        content: {
          en: '<p>Specialized mathematics instruction for students of all levels.</p><p><strong>Offerings:</strong></p><ul><li>Foundational numeracy skills</li><li>Canadian math competition prep</li><li>Grade-level tutoring</li><li>Advanced problem-solving</li><li>Test preparation for standardized exams</li></ul>',
          zh: '<p>面向各水平学生的专业数学辅导。</p><p><strong>课程内容：</strong></p><ul><li>数学基础能力</li><li>加拿大数学竞赛备赛</li><li>各年级同步辅导</li><li>高阶解题训练</li><li>标准化考试备考</li></ul>'
        }
      },
      others: {
        image: 'Images/Others.png',
        title: { en: 'Other Programs', zh: '其他课程' },
        content: {
          en: '<p>Additional specialized instruction beyond our core programs.</p><p><strong>Available Courses:</strong></p><ul><li>Music lessons and instruction</li><li>Robotics and STEM learning</li><li>Subject-specific tutoring</li><li>Academic support services</li><li>Custom program design available</li></ul>',
          zh: '<p>核心课程之外的更多特色课程。</p><p><strong>开设课程：</strong></p><ul><li>音乐课程</li><li>机器人与 STEM 课程</li><li>单科辅导</li><li>学业支持服务</li><li>可定制课程方案</li></ul>'
        }
      }
    };

    let openModalType = null;   // which service the modal is currently showing

    function openModal(type) {
      const data = modalData[type];
      const lang = (localStorage.getItem('site-lang') === 'en') ? 'en' : 'zh';
      document.getElementById('modal-title').textContent = data.title[lang];
      document.getElementById('modal-image').src = data.image;
      document.getElementById('modal-body').innerHTML = data.content[lang];
      document.getElementById('modal').classList.add('show');
      openModalType = type;
    }

    // If the modal is open when the visitor toggles EN/中文, refresh its content.
    window.addEventListener('languageChanged', function () {
      if (openModalType && document.getElementById('modal').classList.contains('show')) {
        openModal(openModalType);
      }
    });

    function closeModal(event) {
      // Ignore clicks that bubble up from inside the modal content; only the
      // backdrop (#modal) or the explicit close button should dismiss it.
      if (event && event.target.id !== 'modal') return;
      document.getElementById('modal').classList.remove('show');
    }


    /* 3. Main app IIFE: i18n + routing + widgets. */
    (function(){
      let currentLang = null; // 'en' | 'zh'; null until first setLang()

      // Translation tables keyed by data-i18n* attribute values in the markup.
      // Every key should exist in both `en` and `zh` (checkI18nParity() below
      // logs any mismatches to the console during development).
      const translations = {
        en: {
          'nav.home': 'Home',
          'nav.chinese': 'Chinese',
          'nav.english': 'English',
          'nav.math': 'Math',
          'nav.french': 'French',
          'nav.ps': 'Public Speaking',
          'nav.teachers': 'Teachers',
          'nav.test': 'Online Test',
          'test.title': 'Online Test',
          'test.desc': 'Take the assessment online — your score is shown as soon as you submit.',
          'nav.partners': 'Partners',
          'nav.life': 'Student Life',
          'nav.contact': 'Contact',
          'hero.h1': 'Duke College — Accredited language training provider in Canada',
          'hero.p': 'Canadian youth reading & writing programs.',
          'btn.courses': 'All Courses',
          'btn.signup': 'Sign Up',
          'about.title': 'About Us',
          'about.desc': 'Duke College is an educational institution dedicated to developing Reading & Writing skills in young learners.Through a structured, scientific, and step-by-step teaching approach, we help students build a strong foundation in reading, enhance their writing skills, and cultivate long-term academic learning abilities.',
          'services.title': 'Courses',
          'services.desc': 'Choose the services you need and contact our advisors for program details and pricing.',
          'english.title': 'English Program',
          'english.desc': 'Structured reading and expression courses designed for different learning stages.',
          'english.section.easyStart': 'Easy Start',
          'english.section.easyChapterBooks': 'Easy Chapter Books',
          'english.section.vastReading': 'Vast Reading',
          'english.section.comprehensiveReading': 'Comprehensive Reading',
          'english.section.speedReading': 'Speed Reading',
          'english.section.powerPresentation': 'Power Presentation',
          'english.section.classicReading': 'Classic Reading',
          'chinese.title': 'Chinese Education Promotion Program',
          'chinese.desc': 'It is not that children cannot learn Chinese, but that the starting method is often wrong. Duke College and the Canada-China Education and Cultural Exchange Association launched a subsidized program.',
          'chinese.poster.alt': 'Chinese education promotion poster',
          'chinese.problem.title': 'Why do many children still struggle after years of Chinese learning?',
          'chinese.problem.list': '<p><strong>Common pain points overseas:</strong></p><ul><li>Cannot decode with pinyin confidently</li><li>Not willing to speak Chinese</li><li>Cannot read Chinese books independently</li><li>Core issue: weak pinyin foundation from the beginning</li></ul>',
          'chinese.launch.title': 'Program Launch and Course Intro',
          'chinese.launch.list': '<ul><li>Jointly launched by Duke College and the Canada-China Education and Cultural Exchange Association</li><li>Professional teachers from Duke College</li><li>Association-appointed lecturer support and public-benefit subsidy</li><li>Designed to help more heritage children learn Chinese with lower barriers</li></ul>',
          'chinese.highlights.title': 'Highlights and Public-Benefit Support',
          'chinese.highlights.list': '<ul><li>Duke College structured curriculum: formal, professional, and systematic</li><li>Association support: nonprofit and public-benefit mission</li><li>5-year proven curriculum system</li><li>50% tuition subsidy sponsored by the association</li><li>Focus pathway: pinyin -> character recognition -> reading</li><li>This is a real competency course, not a casual interest class</li></ul>',
          'chinese.objective.title': 'Initial Goal: Build Foundation, Read, and Speak',
          'chinese.objective.list': '<ol><li>Address common overseas pain points: years of learning but still cannot read, and Chinese feels harder over time</li><li>Provide a practical solution through a newly designed successful program</li></ol>',
          'chinese.solution.title': 'Program Advantages and Solution Design',
          'chinese.solution.list': '<ul><li>Academy-based curriculum system (not pieced together)</li><li>Small-group teaching for measurable outcomes</li><li>Systematic pinyin instruction for true foundation building</li><li>50% tuition subsidy from a public-benefit organization</li></ul>',
          'chinese.outcome.title': 'Expected Learning Outcomes',
          'chinese.outcome.list': '<ul><li>Read pinyin accurately</li><li>Recognize characters independently</li><li>Start reading Chinese picture books</li><li>Build long-term Chinese learning capability</li></ul>',
          'chinese.signup.title': 'Limited Seats and Registration',
          'chinese.signup.list': '<p><strong>Only first 20 students in the initial intake.</strong></p><ul><li>Scan QR code to register</li><li>Add WeChat to consult</li><li>Fill in assessment form and placement evaluation</li></ul>',
          'english.back': 'Back to English Program',
          'english.easyStart.title': 'Easy Start',
          'english.easyStart.desc': 'Foundational English for early learners.',
          'english.easyStart.content': '<h3>Course Focus</h3><ul><li>Letter-sound awareness and phonics basics</li><li>Core vocabulary and sentence patterns</li><li>Simple speaking routines and classroom language</li><li>Reading readiness through guided practice</li></ul>',
          'english.easyChapterBooks.title': 'Easy Chapter Books',
          'english.easyChapterBooks.desc': 'Guided transition from picture books to chapter books.',
          'english.easyChapterBooks.content': '<h3>Course Focus</h3><ul><li>Build reading stamina with short chapter books</li><li>Understand plot, setting, and character basics</li><li>Retell and summarize with clear structure</li><li>Vocabulary growth through contextual reading</li></ul>',
          'english.vastReading.title': 'Vast Reading',
          'english.vastReading.desc': 'Broaden exposure through diverse genres and topics.',
          'english.vastReading.content': '<h3>Course Focus</h3><ul><li>Expand reading volume across fiction and non-fiction</li><li>Develop independent reading habits</li><li>Compare ideas across texts</li><li>Track progress with level-based goals</li></ul>',
          'english.comprehensiveReading.title': 'Comprehensive Reading',
          'english.comprehensiveReading.desc': 'Integrate comprehension, analysis, and response writing.',
          'english.comprehensiveReading.content': '<h3>Course Focus</h3><ul><li>Main idea and supporting detail analysis</li><li>Inference and evidence-based interpretation</li><li>Structured written responses to texts</li><li>Critical thinking and argument clarity</li></ul>',
          'english.speedReading.title': 'Speed Reading',
          'english.speedReading.desc': 'Improve pace while maintaining accuracy and understanding.',
          'english.speedReading.content': '<h3>Course Focus</h3><ul><li>Increase reading rate with timed passages</li><li>Maintain comprehension under time constraints</li><li>Identify key information quickly</li><li>Build exam-ready reading efficiency</li></ul>',
          'english.powerPresentation.title': 'Power Presentation',
          'english.powerPresentation.desc': 'Build confident public speaking with structure and delivery.',
          'english.powerPresentation.content': '<h3>Course Focus</h3><ul><li>Presentation structure: opening, body, conclusion</li><li>Voice, pacing, and audience engagement</li><li>Visual support and speaking notes</li><li>Q&A handling and confidence building</li></ul>',
          'english.classicReading.title': 'Classic Reading',
          'english.classicReading.desc': 'Read classics deeply to strengthen language and thinking.',
          'english.classicReading.content': '<h3>Course Focus</h3><ul><li>Close reading of classic literary texts</li><li>Theme, tone, and author craft analysis</li><li>Discussion and text-based argumentation</li><li>Academic writing linked to reading</li></ul>',
          'math.title': 'Math',
          'math.desc': 'Foundational to competition‑level math support tailored to each student.',
          'math.gr12.view': 'View More',
          'math.gr12.title': 'Grade 1–2 (Units)',
          'math.gr12.desc': 'Singapore Math — Grade 1–2 course units overview.',
          'math.gr12.back': 'Back to Math',
          'math.gr34.view': 'View More',
          'math.gr34.title': 'Grade 3–4 (Units)',
          'math.gr34.desc': 'Singapore Math — Grade 3–4 course units overview.',
          'math.gr34.back': 'Back to Math',
          'math.gr56.view': 'View More',
          'math.gr56.title': 'Grade 5–6 (Units)',
          'math.gr56.desc': 'Grade 5–6 course units overview.',
          'math.gr56.back': 'Back to Math',
          'math.gr12.group1': 'Units 1–6',
          'math.gr12.group2': 'Units 7–12',
          'math.gr12.group3': 'Units 13–17',
          'math.gr34.group1': 'Units 1–5',
          'math.gr34.group2': 'Units 6–10',
          'math.gr34.group3': 'Units 11–15',
          'math.gr56.group1': 'Units 1–4',
          'math.gr56.group2': 'Units 5–8',
          'math.gr56.group3': 'Units 9–11',
          'math.gr12.unit1': '<h3>Unit 1: Numbers within 1000</h3><ul><li>Recognise and write numbers within 1000 in numerals and words</li><li>Identify the place value of numbers within 1000</li><li>Compare and arrange numbers within 1000</li><li>Complete number patterns</li></ul>',
          'math.gr12.unit2': '<h3>Unit 2: Adding Numbers within 1000</h3><ul><li>Perform simple and mental addition of numbers within 1000</li><li>Add numbers within 1000 without regrouping</li><li>Add numbers within 1000 by regrouping ones, tens or hundreds</li></ul>',
          'math.gr12.unit3': '<h3>Unit 3: Subtracting Numbers within 1000</h3><ul><li>Perform simple and mental subtraction of numbers within 1000</li><li>Subtract numbers within 1000 without regrouping</li><li>Subtract numbers within 1000 by regrouping ones, tens or hundreds</li><li>Subtract numbers within 1000 across zeroes</li></ul>',
          'math.gr12.unit4': '<h3>Unit 4: Word Problems on Addition and Subtraction</h3><ul><li>Add and subtract using part-whole</li><li>Add and subtract by adding on and taking away sets</li><li>Add and subtract by comparing two sets</li></ul>',
          'math.gr12.unit5': '<h3>Unit 5: Multiplying and Dividing</h3><ul><li>Multiply using equal groups and repeated addition</li><li>Divide by sharing equally and using equal groups</li><li>Make multiplication and division stories</li></ul>',
          'math.gr12.unit6': '<h3>Unit 6: Multiplying and Dividing Numbers by 2, 5 and 10</h3><ul><li>Multiply numbers within multiplication table of 2</li><li>Multiply numbers within multiplication table of 5</li><li>Multiply numbers within multiplication table of 10</li><li>Multiply numbers in any order</li><li>Divide numbers using multiplication facts</li></ul>',
          'math.gr12.unit7': '<h3>Unit 7: Multiplying and Dividing Numbers by 3 and 4</h3><ul><li>Multiply numbers within multiplication table of 3</li><li>Multiply numbers within multiplication table of 4</li><li>Multiply numbers in any order</li><li>Divide numbers using multiplication facts</li><li>Write multiplication and division fact families</li></ul>',
          'math.gr12.unit8': '<h3>Unit 8: Word Problems on Multiplication and Division</h3><ul><li>Solve multiplication word problems</li><li>Solve division word problems</li></ul>',
          'math.gr12.unit9': '<h3>Unit 9: Length</h3><ul><li>Measure length, width and height using a metre rule</li><li>Compare and order lengths in metres</li><li>Measure lengths of shorter objects in centimetres</li><li>Compare and order lengths in centimetres</li><li>Add and subtract length</li><li>Multiply and divide length</li></ul>',
          'math.gr12.unit10': '<h3>Unit 10: Two-Step Word Problems on Addition and Subtraction</h3><ul><li>Solve two-step addition and subtraction word problems</li></ul>',
          'math.gr12.unit11': '<h3>Unit 11: Mass</h3><ul><li>Compare two or more masses</li><li>Measure and compare masses in kilograms</li><li>Measure and compare masses in grams</li><li>Add and subtract mass</li><li>Multiply and divide mass</li></ul>',
          'math.gr12.unit12': '<h3>Unit 12: Money</h3><ul><li>Find the value of a group of notes and coins</li><li>Change cents and dollars</li><li>Compare money</li><li>Solve word problems related to money</li></ul>',
          'math.gr12.unit13': '<h3>Unit 13: Two-Dimensional and Three-Dimensional Figures</h3><ul><li>Recognise squares, rectangles, triangles, circles, semicircles and quarter circles</li><li>Combine shapes to make new figures</li><li>Draw figures using dot or square grid paper</li><li>Recognise cubes, cuboids, cones, cylinders and spheres</li><li>Combine solids to make new figures</li><li>Make patterns with shapes</li><li>Make patterns with solids</li></ul>',
          'math.gr12.unit14': '<h3>Unit 14: Fractions</h3><ul><li>Understand that fractions are equal parts</li><li>Understand parts and whole</li><li>Compare fractions</li><li>Arrange fractions</li><li>Add and subtract like fractions</li></ul>',
          'math.gr12.unit15': '<h3>Unit 15: Time</h3><ul><li>Read and write the correct time</li><li>Draw hour and minute hands correctly</li><li>Use am and pm correctly</li><li>Find the time after a certain time given the duration of half hour or one hour</li></ul>',
          'math.gr12.unit16': '<h3>Unit 16: Picture Graphs</h3><ul><li>Read and understand picture graphs with scales</li><li>Create picture graphs with scales</li></ul>',
          'math.gr12.unit17': '<h3>Unit 17: Volume</h3><ul><li>Compare volumes of liquid</li><li>Read and measure volume of liquid in litres</li><li>Solve word problems related to adding, subtracting, multiplying and dividing volume</li></ul>',
          'math.gr34.unit1': '<h3>Unit 1: Numbers within 100 000</h3><ul><li>Count and write numbers within 100 000 in numerals and words</li><li>Understand the place value of numbers within 100 000</li><li>Compare and arrange numbers within 100 000</li><li>Complete number patterns</li><li>Round off numbers to the nearest ten, hundred and thousand</li><li>Estimate sums and differences</li></ul>',
          'math.gr34.unit2': '<h3>Unit 2: Factors and Multiples</h3><ul><li>List factors and common factors of whole numbers</li><li>List multiples and common multiples of whole numbers</li></ul>',
          'math.gr34.unit3': '<h3>Unit 3: Multiplying and Dividing Whole Numbers</h3><ul><li>Multiply by 1-digit and 2-digit numbers</li><li>Divide by 1-digit numbers</li><li>Estimate answers in multiplication and division</li><li>Check that answers are reasonable</li></ul>',
          'math.gr34.unit4': '<h3>Unit 4: Word Problems on Whole Numbers</h3><ul><li>Solve up to three-step word problems</li></ul><p style="margin: 10px 0 0; color: var(--muted); font-size: 14px;">Non-Routine Questions 1 — Heuristics: The Before-After Concept; Word Problems</p>',
          'math.gr34.unit5': '<h3>Unit 5: Angles</h3><ul><li>Understand and measure angles</li><li>Draw angles to 180°</li><li>Understand turns and an 8-point compass</li></ul>',
          'math.gr34.unit6': '<h3>Unit 6: Squares and Rectangles</h3><ul><li>Recognise properties of squares and rectangles</li><li>Find unknown lengths in squares and rectangles</li><li>Find unknown angles in squares and rectangles</li><li>Draw squares and rectangles</li></ul>',
          'math.gr34.unit7': '<h3>Unit 7: Symmetry</h3><ul><li>Identify symmetric figures</li><li>Identify the lines of symmetry in figures</li><li>Complete symmetric figures and patterns</li></ul>',
          'math.gr34.unit8': '<h3>Unit 8: Fractions</h3><ul><li>Recognise mixed numbers and improper fractions</li><li>Convert mixed numbers to improper fractions or improper fractions to mixed numbers</li><li>Compare and order fractions</li><li>Understand fraction of a set</li></ul>',
          'math.gr34.unit9': '<h3>Unit 9: Adding and Subtracting Fractions</h3><ul><li>Add and subtract fractions</li><li>Solve word problems related to addition and subtraction of fractions</li></ul>',
          'math.gr34.unit10': '<h3>Unit 10: Decimals</h3><ul><li>Understand tenths, hundredths and thousandths</li><li>Compare and order decimals</li><li>Round off decimals to the nearest whole number, 1 decimal place or 2 decimal places</li><li>Express a fraction as a decimal, and vice versa</li></ul>',
          'math.gr34.unit11': '<h3>Unit 11: Four Operations of Decimals</h3><ul><li>Add and subtract decimals</li><li>Multiply and divide decimals</li><li>Estimate the value of decimals</li><li>Check that answers are reasonable</li></ul>',
          'math.gr34.unit12': '<h3>Unit 12: Word Problems on Decimals</h3><ul><li>Solve word problems related to decimals</li></ul>',
          'math.gr34.unit13': '<h3>Unit 13: Area and Perimeter</h3><ul><li>Calculate perimeter and area of rectangles, squares and composite figures</li><li>Find length or breadth of a rectangle/square given its perimeter/area</li><li>Solve word problems related to perimeter and area</li></ul>',
          'math.gr34.unit14': '<h3>Unit 14: Tables and Line Graphs</h3><ul><li>Read and understand data in a table</li><li>Complete tables using given data</li><li>Solve problems using given data in line graphs</li></ul>',
          'math.gr34.unit15': '<h3>Unit 15: Time</h3><ul><li>Measure time in seconds</li><li>Express time in 12-hour clock and 24-hour clock</li><li>Find the duration of two different times</li><li>Calculate the starting or ending time given the duration</li><li>Solve word problems related to time</li></ul>',
          'math.gr56.unit1': '<h3>Unit 1: Algebra</h3><ul><li>Use a letter to denote an unknown number</li><li>Evaluate and simplify an algebraic expression</li><li>Solve word problems related to algebra</li></ul>',
          'math.gr56.unit2': '<h3>Unit 2: Fractions</h3><ul><li>Divide a fraction by a whole number</li><li>Divide a whole number by a proper fraction</li><li>Divide a proper fraction by a proper fraction</li><li>Solve word problems related to fractions</li></ul>',
          'math.gr56.unit3': '<h3>Unit 3: Ratio</h3><ul><li>Relate ratio to fraction</li><li>Compare ratios</li><li>Solve word problems related to ratios</li></ul>',
          'math.gr56.unit4': '<h3>Unit 4: Percentage</h3><ul><li>Find percentages</li><li>Find percentage change</li><li>Solve word problems related to percentage, discount, GST, percentage increase and percentage decrease</li></ul>',
          'math.gr56.unit5': '<h3>Unit 5: Circles</h3><ul><li>Recognise centre, radius, diameter and circumference of a circle as well as semicircle and quarter circle</li><li>Calculate the circumference and area of a circle using the formula</li><li>Calculate the perimeter and area of composite figures</li><li>Solve word problems related to circles and composite figures</li></ul>',
          'math.gr56.unit6': '<h3>Unit 6: Angles in Geometric Figures</h3><ul><li>Calculate unknown angles in geometric figures like square, rectangle, parallelogram, rhombus, trapezium and different types of triangles</li></ul>',
          'math.gr56.unit7': '<h3>Unit 7: Speed</h3><ul><li>Understand distance and speed</li><li>Find average speed</li><li>Solve word problems related to speed</li></ul>',
          'math.gr56.unit8': '<h3>Unit 8: Volume of Solids and Liquids</h3><ul><li>Find square root and cube root with the use of a calculator</li><li>Calculate the volume of solids</li><li>Find the edge of a cube given its volume</li><li>Find one dimension of a cuboid given its volume and the other dimensions</li><li>Find height, surface area and volume of solids and liquids</li><li>Solve word problems related to volume</li></ul>',
          'math.gr56.unit9': '<h3>Unit 9: Pie Charts</h3><ul><li>Read and interpret pie charts</li></ul>',
          'math.gr56.unit10': '<h3>Unit 10: Solid Figures and Nets</h3><ul><li>Identify different types of solids</li><li>Identify and state the number of faces of a cube, cuboid, prism and pyramid</li><li>Identify the nets of a solid such as cube, cuboid, prism and pyramid</li><li>Recognise a solid based on its net</li></ul>',
          'math.gr56.unit11': '<h3>Unit 11: Challenging Word Problems</h3><ul><li>Solve word problems related to whole numbers, fractions, decimals, ratio, percentage and speed</li></ul>',
          'contests.title': 'Math Competitions',
          'contests.desc': 'Five key contests with details and timelines.',
          'contest.back': 'Back to Math',
          'contest.eligibility': 'Eligibility',
          'contest.exam': 'Exam Time',
          'contest.features': 'Key Features',
          'contest.kangaroo.card.title': 'Math Kangaroo Canada',
          'contest.kangaroo.card.desc': 'International contest focused on fun problem solving.',
          'contest.beaver.card.title': 'Beaver Computing Challenge',
          'contest.beaver.card.desc': 'Computational thinking and logic, no coding required.',
          'contest.mc.card.title': 'Mathematica Centrum Contest',
          'contest.mc.card.desc': 'Canadian contest with progressive difficulty.',
          'contest.amc8.card.title': 'AMC 8',
          'contest.amc8.card.desc': '25 multiple-choice questions, strong reasoning focus.',
          'contest.amc10_12.card.title': 'AMC 10 / AMC 12',
          'contest.amc10_12.card.desc': 'Key pathway to AIME with advanced algebra and logic.',
          'contest.kangaroo.title': 'Math Kangaroo Canada',
          'contest.kangaroo.desc': 'International math contest known for fun, logical problems.',
          'contest.kangaroo.range': 'Grades 1–12',
          'contest.kangaroo.grades': 'Grades: 1–12',
          'contest.kangaroo.groups': 'Divisions: G1–2, G3–4, G5–6, G7–8, G9–10, G11–12',
          'contest.kangaroo.time': 'Every March',
          'contest.kangaroo.feature1': 'International math contest',
          'contest.kangaroo.feature2': 'Fun and thinking-based questions',
          'contest.kangaroo.feature3': 'Emphasis on logical reasoning and strategy',
          'contest.kangaroo.feature4': 'Non-textbook style problems',
          'contest.beaver.title': 'Beaver Computing Challenge',
          'contest.beaver.desc': 'Computational thinking contest with logic and information processing.',
          'contest.beaver.range': 'Grades 2–12',
          'contest.beaver.grades': 'Grades: 2–12',
          'contest.beaver.time': 'Every November',
          'contest.beaver.feature1': 'Focus on computational thinking',
          'contest.beaver.feature2': 'Logic and information processing',
          'contest.beaver.feature3': 'Great for students with strong math basics',
          'contest.beaver.feature4': 'No programming required',
          'contest.mc.title': 'Mathematica Centrum Contest',
          'contest.mc.desc': 'Canadian contest emphasizing number sense and problem solving.',
          'contest.mc.range': 'Grades 1–8',
          'contest.mc.grades': 'Grades: 1–8',
          'contest.mc.time': 'Every April',
          'contest.mc.feature1': 'Canada-based competition',
          'contest.mc.feature2': 'Emphasis on number sense and problem solving',
          'contest.mc.feature3': 'Clear progression in difficulty',
          'contest.mc.feature4': 'Suitable for systematic training',
          'contest.amc8.title': 'AMC 8',
          'contest.amc8.desc': 'Entry point to AMC competitions with strong reasoning focus.',
          'contest.amc8.range': 'Grade 8 and below',
          'contest.amc8.grades': 'Grades: 8 and below',
          'contest.amc8.time': 'Every January',
          'contest.amc8.feature1': 'U.S. AMC competition system',
          'contest.amc8.feature2': '25 multiple-choice questions',
          'contest.amc8.feature3': 'Focus on higher-order thinking and strategy',
          'contest.amc8.feature4': 'Important starting point for contest math',
          'contest.amc10_12.title': 'AMC 10 / AMC 12',
          'contest.amc10_12.desc': 'Key pathway to AIME with advanced algebra and reasoning.',
          'contest.amc10_12.range': 'AMC 10: Grade 10 and below • AMC 12: Grade 12 and below',
          'contest.amc10_12.grades': 'AMC 10: Grade 10 and below; AMC 12: Grade 12 and below',
          'contest.amc10_12.time': 'Every November',
          'contest.amc10_12.feature1': 'Important pathway to AIME',
          'contest.amc10_12.feature2': 'High-intensity logic and algebra reasoning',
          'contest.amc10_12.feature3': 'Strong value for top university applications',
          'french.title': 'French',
          'french.desc': 'Comprehensive French language instruction for young learners and exam preparation.',
          'french.track1.title': 'Foundations',
          'french.track1.item1.title': 'Core Skills',
          'french.track1.item1.desc': 'Basic phonics, vocabulary and beginner grammar for early learners.',
          'french.track1.item2.title': 'Homework & Practice',
          'french.track1.item2.desc': 'Regular practice to build listening, speaking and reading fluency.',
          'french.track2.title': 'Communication',
          'french.track2.item1.title': 'Conversational French',
          'french.track2.item1.desc': 'Interactive speaking classes focused on practical communication.',
          'french.track2.item2.title': 'Cultural Activities',
          'french.track2.item2.desc': 'Cultural projects and activities to reinforce language learning.',
          'french.track3.title': 'Exam Prep',
          'french.track3.item1.title': 'DELF/DALF Preparation',
          'french.track3.item1.desc': 'Targeted training for French proficiency exams and certification.',
          'french.track3.item2.title': 'High School Support',
          'french.track3.item2.desc': 'Coursework support and exam strategies for secondary students.',
          'ps.hero.title': 'Public Speaking Program',
          'ps.hero.desc': 'Build confidence, clarity, and critical thinking through structured speech training.',
          'ps.back': 'Back to Public Speaking',
          'ps.overview.title': 'Program Overview',
          'ps.overview.desc': 'Our program goes beyond simply standing up and speaking.',
          'ps.overview.list': '<ul><li>Organize ideas logically</li><li>Speak clearly and confidently</li><li>Engage an audience</li><li>Develop critical thinking</li><li>Express opinions with structure and evidence</li></ul>',
          'ps.overview.note': '<p>We help students speak with logic, structure, and depth—not just courage.</p>',
          'ps.gr13.title': 'Grade 1–3 Public Speaking',
          'ps.gr13.desc': 'Based on creative and structured topic themes, students explore:',
          'ps.gr13.summary': 'Creative topics and guided structure to build confidence and clear expression.',
          'ps.gr13.section.topics': 'Topics',
          'ps.gr13.section.skills': 'Guided Preparation',
          'ps.gr13.topic.creative': '<h3>Creative & Fun Topics</h3><ul><li>If I Were a Superhero</li><li>What Would I Invent?</li><li>My Favorite Planet</li></ul>',
          'ps.gr13.topic.everyday': '<h3>Everyday Life with a Twist</h3><ul><li>The Perfect Playground</li><li>Why It\'s Important to Say “Thank You”</li></ul>',
          'ps.gr13.topic.explore': '<h3>Exploration & Discovery</h3><ul><li>Why the Ocean Is Important</li><li>What Would Happen Without Electricity?</li></ul>',
          'ps.gr13.topic.values': '<h3>Values & Character</h3><ul><li>Why Being Kind Matters</li><li>How to Be a Good Friend</li></ul>',
          'ps.gr13.skills': '<h3>Guided Preparation</h3><ul><li>Introduction – Body – Conclusion structure</li><li>Eye contact and voice projection</li><li>Basic persuasive speaking</li><li>Answering simple audience questions</li></ul>',
          'ps.gr46.title': 'Grade 4–6 Public Speaking',
          'ps.gr46.desc': 'Students move from storytelling to structured argumentation.',
          'ps.gr46.summary': 'Structured persuasion, evidence-based ideas, and debate readiness.',
          'ps.gr46.section.focus': 'Training Focus',
          'ps.gr46.section.topics': 'Sample Topics',
          'ps.gr46.focus': '<h3>Training Focus</h3><ul><li>Structured persuasive speeches</li><li>Supporting ideas with examples</li><li>Comparing viewpoints</li><li>Debate introduction skills</li><li>Q&A handling</li></ul>',
          'ps.gr46.topics': '<h3>Sample Topics</h3><ul><li>Should homework be reduced?</li><li>Why teamwork matters</li><li>Technology: helpful or harmful?</li><li>Environmental responsibility</li></ul>',
          'ps.skills.title': 'Skills Students Develop',
          'ps.skills.list': '<ul><li>Confidence on stage</li><li>Clear pronunciation</li><li>Logical organization</li><li>Critical thinking</li><li>Cultural awareness</li><li>Academic vocabulary</li></ul>',
          'ps.why.title': 'Why Public Speaking Matters',
          'ps.why.desc': 'Strong speakers often become strong writers and strong thinkers.',
          'ps.why.list': '<ul><li>Academic performance</li><li>Writing skills</li><li>Leadership development</li><li>University readiness</li></ul>',
          'ps.format.title': 'Course Format',
          'ps.format.list': '<ul><li>Small group instruction</li><li>Guided topic preparation</li><li>Weekly speech delivery</li><li>Individual feedback</li><li>Performance-based progress tracking</li></ul>',
          'ps.cta.primary': 'Talk to an Advisor',
          'ps.cta.secondary': 'Back to Courses',
          'teachers.title': 'Our Teachers',
          'teachers.desc': 'Meet our experienced and dedicated team of educators.',
          'teachers.t1.name': 'Mr. Daniel Huang',
          'teachers.t1.title': 'English Program',
          'teachers.t1.bio': 'MA in Education (Towson University), graduated from Shanghai International Studies University. 25+ years language teaching experience in China and Canada, specialized in ESL/IELTS/TOEFL (former instructor at New Oriental Education & Technology Group).',
          'teachers.t2.name': 'Mr. Donald Qi',
          'teachers.t2.title': 'English Program',
          'teachers.t2.bio': 'He graduated from Fudan University in Shanghai and stayed on as a faculty member teaching British and American literature. He later earned an MA in Literature from Queen\'s University and a Doctorate in Education from the University of Toronto. He worked for many years in language teaching assessment and evaluation at the Toronto District School Board, and taught academic writing at multiple universities and colleges across Canada. He currently serves as a senior education consultant and academic writing instructor at Duke College.',
          'teachers.t3.name': 'Ms. Maggie Chan',
          'teachers.t3.title': 'English Program',
          'teachers.t3.bio': 'Graduated from Western University in Canada with studies in Economics and Languages, and holds a Canadian TESL teaching certificate. She is now a leading instructor for Duke IELTS and Reading Town youth reading and writing programs. With years of study-abroad and teaching experience in top secondary schools in Hong Kong and Canada, she is patient, detail-oriented, professional, and highly loved by elementary and middle school students.',
          'teachers.t4.name': 'Dr. Jovana Pokrajac',
          'teachers.t4.title': 'English Program',
          'teachers.t4.bio': 'BA and MA in English (York University), PhD in Modern Literature (University of Ottawa). Former university professor with 3+ years at Duke College, specialized in university-level academic writing and writing skills development.',
          'teachers.t5.name': 'Ms. Chengyi Tang',
          'teachers.t5.title': 'French Program',
          'teachers.t5.bio': 'Graduated from Montreal French university, French Band 10, IELTS 8.0 (trained in Toronto). Online French instructor at Duke College since November 2021, beloved by young students.',
          'teachers.t6.name': 'Ms. Maria Carbajal',
          'teachers.t6.title': 'ESL Program',
          'teachers.t6.bio': 'Bachelor of Arts with Honours (Queen\'s University), International Baccalaureate graduate. Teaching at Duke Academy/Reading Town since July 2020, specialized in personalized learning plans based on student goals and levels, interactive and friendly classroom style.',
          'teachers.t7.name': 'Ms. Gabby Richardson',
          'teachers.t7.title': 'English Program',
          'teachers.t7.bio': 'MA from University of Guelph, professional English writing instructor at Reading Town. Extensive online ESL teaching experience, specialized in writing expression and language foundation development.',
          'teachers.t8.name': 'Mr. Alireza Riasati',
          'teachers.t8.title': 'English Program',
          'teachers.t8.bio': 'Former language professor at Malaysian universities, teaching at Duke Academy for 3 years. ESL expert and IELTS examiner, specialized in IELTS/TOEFL/CELPIP/Duolingo test preparation.',
          'teachers.t9.name': 'Mr. Dara Sadeghi',
          'teachers.t9.title': 'English Program',
          'teachers.t9.bio': 'MA in Geography and Political Studies (American Modern University), professional instructor at Duke College. 10 years teaching ESL/IELTS/TOEFL/CELPIP to youth and adults, highly popular among international students.',
          'math.track1.title': 'Basic Math',
          'math.track1.item1.title': 'Grade 1-2',
          'math.track1.item1.desc': 'Number sense, algebra basics, and problem‑solving practice.',
          'math.track1.item2.title': 'Grade 3-4',
          'math.track1.item2.desc': 'Weekly tutoring to reinforce classroom learning.',
          'math.track1.item3.title': 'Grade 5-6',
          'math.track2.title': 'Enrichment',
          'math.track2.item1.title': 'Advanced Topics',
          'math.track2.item1.desc': 'Challenge problems, logic, and contest techniques.',
          'math.track2.item2.title': 'Competition Prep',
          'math.track2.item2.desc': 'AMC/Canadian competitions training and mock tests.',
          'math.track3.title': 'High School',
          'math.track3.item1.title': 'Credit Courses',
          'math.track3.item1.desc': 'Functions, advanced functions, calculus readiness.',
          'math.track3.item2.title': 'Exam Support',
          'math.track3.item2.desc': 'Targeted review and exam strategies.',
          'partners.title': 'Partners',
          'partners.desc': 'Our close partner organizations',
          'life.title': 'Monthly Events',
          'life.desc': 'Past event highlights',
          'testimonials.title': 'What Students & Parents Say',
          'contact.title': 'Contact Us',
          'link.view': 'View',
          'cat.k12.title': 'Reading & Writing Course',
          'cat.esl.title': 'ESL Course of Canada',
          'cat.tests.title': 'Language Test Preparation Course',
          'cat.ps.title': 'Public Speaking Course',
          'cat.math.title': 'Math Course',
          'cat.others.title': 'Other Courses',
          'svc.jump.title': 'Jump Start (K–G2)',
          'svc.jump.desc': 'Phonics and early reading foundations with placement checks and weekly progress notes.',
          'svc.readingclub.title': 'Reading Club (G2–G8)',
          'svc.readingclub.desc': 'Leveled guided reading to improve fluency, comprehension and vocabulary.',
          'svc.classic.title': 'Classic Reading (G9–G12)',
          'svc.classic.desc': 'Close reading and literary analysis to prepare students for senior courses and exams.',
          'svc.academicwriting.title': 'Academic Writing (G8–G12)',
          'svc.academicwriting.desc': 'Practical essay and research writing skills with targeted feedback for improvement.',
          'svc.publicspeaking.title': 'Public Speaking (G4–G8)',
          'svc.publicspeaking.desc': 'Short‑format speaking practice to build confidence, clarity and pronunciation.',
          'svc.youth.title': 'Youth ESL',
          'svc.youth.desc': 'Interactive youth program combining language learning with cultural activities and leadership development.',
          'svc.highschool.title': 'High School ESL',
          'svc.highschool.desc': 'Comprehensive ESL classes for high‑school students focusing on academic vocabulary, reading comprehension and exam preparation.',
          'svc.adult.title': 'Adult ESL',
          'svc.adult.desc': 'Practical English for adults emphasizing workplace communication, conversation and professional writing.',
          'svc.ielts.title': 'IELTS',
          'svc.ielts.desc': 'Targeted IELTS training for band improvement across Listening, Reading, Writing and Speaking.',
          'svc.toefl.title': 'TOEFL',
          'svc.toefl.desc': 'Strategic TOEFL prep focusing on academic English and test‑taking techniques.',
          'svc.celpip.title': 'CELPIP',
          'svc.celpip.desc': 'CELPIP practice modules and timed mock tests to build speed and accuracy.',
          'svc.duolingo.title': 'Duolingo',
          'svc.duolingo.desc': 'Concise Duolingo test drills and adaptive practice for rapid improvement.',
          'svc.other.title': 'Other Tests',
          'svc.other.desc': 'Custom test prep for additional English proficiency exams on request.',
          'life.event1.title': 'Public Speaking Awards Phase',
          'life.event1.desc': 'Student recognition ceremony celebrating outstanding presentations and speaking achievements throughout the year.',
          'about.cert': 'Duke College ESL learning ability certification (Canada)',
          'about.highlights.title': 'Highlights',
          'about.highlights.li1': 'Language learning centre: K-12 Reading & Writing Program / ESL / Test Preparation',
          'about.highlights.li2': 'High-school academic support: credit improvement / condensed subject tutoring',
          'about.highlights.li3': 'Competitions & interest training: math contests / music lessons / robotics',
          'life.event1.imgAlt': 'Public Speaking Awards',
          'life.event2.title': 'Public Speaking Excellent Student',
          'life.event2.desc': 'Highlighting top performers in our public speaking program who demonstrate exceptional confidence and clarity.',
          'life.event2.imgAlt': 'Excellent Student',
          'life.event3.title': 'Fall Event – Train Museum Tour',
          'life.event3.desc': 'Educational excursion exploring railway history and cultural exhibits during our fall program season.',
          'life.event3.imgAlt': 'Train Museum Tour',
          'life.event4.title': 'Maple Syrup Field Trip',
          'life.event4.desc': 'Hands-on spring field trip to experience Maple Syrup Festival traditions and seasonal learning activities.',
          'life.event4.imgAlt': 'Maple Syrup Field Trip',
          'life.event5.title': '2026 Duke Book Report Presentation',
          'life.event5.desc': 'Studentsshowcase their reading achievements on stage. Through book sharing and public speaking training, they develop comprehension, confident expression, and logical thinking skills.',
          'life.event5.imgAlt': '2026 Duke Book Report Presentation',
          'about.cert': 'Duke College ESL learning ability certification (Canada)',
          'about.highlights.title': 'Highlights',
          'about.highlights.li1': 'Language learning centre: K-12 Reading & Writing Program / ESL / Test Preparation',
          'about.highlights.li2': 'High-school academic support: credit improvement / condensed subject tutoring',
          'about.highlights.li3': 'Competitions & interest training: math contests / music lessons / robotics',
          'testi.1.quote': '"Even though English is our home language, Duke College strengthened my child’s academic writing in a way school never did. The book reports and guided discussions helped him develop genuine analytical thinking and more structured expression."',
          'testi.1.author': '— Local Parent (Grade 5, Non-ESL)',
          'testi.2.quote': '"I used to think reading was boring. Now I actually enjoy finishing chapter books because we talk about the characters, themes, and meaning—not just the story. Writing book reports feels much easier and more organized than before."',
          'testi.2.author': '— Grade 6 Student',
          'testi.3.quote': '"The leveled reading system is very systematic. My child moved step by step from picture books to early chapter books with confidence. The progress was steady, measurable, and thoughtfully guided."',
          'testi.3.author': '— Grade 3 ESL Student Parent',
          'label.email': 'Your email',
          'placeholder.email': 'you@example.com',
          'label.name': 'Name',
          'placeholder.first': 'First name',
          'placeholder.last': 'Last name',
          'label.message': 'Message / Requirements',
          'placeholder.message': 'Please briefly describe your needs...',
          'btn.submit': 'Submit',
          'contact.info.title': 'Contact Info',
          'contact.info.content': '📧 dukecollege8@gmail.com<br/>☎︎ (905) 569‑0511<br/>☎︎ (647) 987‑2623<br/>📍 250 Ferrier St, Markham, ON L3R 2Z5',
          'contact.info.hours': 'Office hours: Mon–Sat 10:00–20:00',
          'contact.qr.title': 'Scan to Contact Us',
          'contact.qr.desc': 'Scan the QR code with WeChat to get the latest course information and registration details.',
          'downloads.title': 'Downloads',
          'downloads.sample': 'Sample Schedule.pdf',
          'downloads.guardian': 'Guardian Services Guide.pdf',
          'footer.copy': 'Duke College And Business Technology · All rights reserved',
          'topbar.contact': '📧 dukecollege8@gmail.com · ☎︎ (905) 569‑0511 · ☎︎ (647) 987‑2623',
          'social.facebook': 'Facebook',
          'social.instagram': 'Instagram',
          'partner.a': 'IELTS',
          'partner.b': 'CELPIP',
          'partner.c': 'VIP Teaching',
          'partner.d': 'Western University', 
          'partner.e': ' Dong_An Educational Services Canada Inc.',
          'partner.f': 'CCISS',
          'partner.g': 'CAIE',
          'partner.h': 'Toronto University',
          'partner.i': 'McGill University',
          'partner.j': 'Waterloo University',
          'partner.k': 'Mount Saint Vincent University (MSVU) - Duke College Language Pathway',
          'partner.l': 'International Centre for English Academic Preparation (ICEAP), King\'s University College at Western University - ICEAP Toronto',
          'partner.m': 'Michael Su & Associates',
          'partner.n': 'Prospect International Consulting',
          'partner.o': 'Canada Glory Immigration',
          'partner.p': 'BTA Study Abroad Consultant Doctor Studio (USA)',
          'partner.q': 'Superstar Music School (Toronto)',
          'partner.r': 'Axis Fencing Club (Markham)',
          'partner.s': 'CECAC'
        },
        // Chinese strings — same keys as `en` above.
        zh: {
          'nav.chinese': '中文',
          'nav.french': '法语',
          'nav.ps': '公共演讲',
          'nav.teachers': '师资团队',
          'nav.test': '在线测试',
          'test.title': '在线测试',
          'test.desc': '完成在线测评，提交后即时显示成绩。',
          'chinese.title': '中文教育推广项目',
          'chinese.desc': '不是学不会，是一开始就没学对。加中教育文化交流协会携手杜克学院推出公益补贴中文课程。',
          'chinese.poster.alt': '中文教育推广海报',
          'chinese.problem.title': '为什么很多孩子学了几年中文仍然吃力？',
          'chinese.problem.list': '<p><strong>在海外，很多孩子学了几年中文：</strong></p><ul><li>不会拼读</li><li>不敢开口</li><li>看不懂中文书</li><li>问题往往出在：拼音基础没打好</li></ul>',
          'chinese.launch.title': '项目发起与课程简介',
          'chinese.launch.list': '<ul><li>加中教育文化交流协会携手杜克学院，推出全新中文教育推广项目</li><li>杜克学院引入专业优秀教师教学</li><li>协会特聘讲师支持，并提供公益资助</li><li>让更多华裔孩子低门槛学好中文</li></ul>',
          'chinese.highlights.title': '课程亮点与公益支持',
          'chinese.highlights.list': '<ul><li>杜克学院开课：专业、正规、有体系</li><li>协会支持：非盈利 + 公益属性</li><li>5年成熟课程体系：正规、专业、放心</li><li>加中协会赞助补贴50%学费</li><li>体现学员公益补贴、扶持，机会难得</li><li>家长期待的学习路径：拼音 -> 识字 -> 阅读</li><li>不是兴趣班，是能力课</li></ul>',
          'chinese.objective.title': '初期目标：打基础、能读、能开口',
          'chinese.objective.list': '<ol><li>直击痛点：孩子学中文几年还是不会读；在海外中文越学越难；拼音没打好导致持续补漏洞</li><li>给出解决方案：引入全新成功设计项目</li></ol>',
          'chinese.solution.title': '项目优势与解决方案',
          'chinese.solution.list': '<ul><li>学院体系课程（非随便拼凑）</li><li>小班授课（保证效果）</li><li>拼音系统教学（真正打基础）</li><li>协会资助50%学费（社会公益服务机构）</li></ul>',
          'chinese.outcome.title': '学习结果预期',
          'chinese.outcome.list': '<p>孩子能获得什么？</p><ul><li>能正确拼读</li><li>能独立认字</li><li>能开始阅读中文绘本</li><li>建立长期中文学习能力</li></ul>',
          'chinese.signup.title': '限额与报名方式',
          'chinese.signup.list': '<p><strong>名额有限：仅限首批前20人，先报先得。</strong></p><p>报名方式：</p><ul><li>扫码报名</li><li>添加微信</li><li>填写评估表与测评</li></ul>',
          'french.title': '法语',
          'french.desc': '法语课程，从入门到考试备考，适合青少年学习者。',
          'french.track1.title': '基础课程',
          'french.track1.item1.title': '核心能力',
          'french.track1.item1.desc': '音标、基础词汇与初级语法。',
          'french.track1.item2.title': '作业与练习',
          'french.track1.item2.desc': '定期练习以提升听说读写流利度。',
          'french.track2.title': '交际课程',
          'french.track2.item1.title': '会话法语',
          'french.track2.item1.desc': '以实用交流为主的口语课程。',
          'french.track2.item2.title': '文化活动',
          'french.track2.item2.desc': '通过文化项目巩固语言学习。',
          'french.track3.title': '考试与进阶',
          'french.track3.item1.title': 'DELF/DALF 备考',
          'french.track3.item1.desc': '针对法语能力考试的专项训练与认证准备。',
          'french.track3.item2.title': '高中支持',
          'french.track3.item2.desc': '面向中学学生的课程辅导与考试策略。',
          'ps.hero.title': '公共演讲课程',
          'ps.hero.desc': '通过结构化演讲训练，培养清晰表达、自信演讲与思辨能力。',
          'ps.back': '返回公共演讲课程',
          'ps.overview.title': '课程介绍',
          'ps.overview.desc': '课程不仅训练“敢开口”，更帮助学生有逻辑、有条理地表达。',
          'ps.overview.list': '<ul><li>逻辑组织观点</li><li>清晰、自信地表达</li><li>吸引并引导听众</li><li>培养批判性思维</li><li>用结构和证据表达观点</li></ul>',
          'ps.overview.note': '<p>帮助学生在表达上做到有结构、有深度、有说服力。</p>',
          'ps.gr13.title': '一年级–三年级 演讲基础',
          'ps.gr13.desc': '以创意与结构化主题为引导，学生将探索：',
          'ps.gr13.summary': '创意主题与结构化训练，帮助建立自信与清晰表达。',
          'ps.gr13.section.topics': '主题',
          'ps.gr13.section.skills': '基础训练重点',
          'ps.gr13.topic.creative': '<h3>创意与趣味主题</h3><ul><li>如果我是超级英雄</li><li>我会发明什么？</li><li>我最喜欢的星球</li></ul>',
          'ps.gr13.topic.everyday': '<h3>日常生活小创意</h3><ul><li>完美的游乐场</li><li>为什么说“谢谢”很重要</li></ul>',
          'ps.gr13.topic.explore': '<h3>探索与发现</h3><ul><li>海洋为什么重要</li><li>没有电会发生什么？</li></ul>',
          'ps.gr13.topic.values': '<h3>价值观与品格</h3><ul><li>善良为什么重要</li><li>如何做一个好朋友</li></ul>',
          'ps.gr13.skills': '<h3>基础训练重点</h3><ul><li>开头–主体–结尾结构</li><li>眼神交流与声音投射</li><li>基础说服性表达</li><li>回答简单观众问题</li></ul>',
          'ps.gr46.title': '四年级–六年级 逻辑表达与思辨',
          'ps.gr46.desc': '从故事表达逐步过渡到结构化论证。',
          'ps.gr46.summary': '结构化说服、证据支撑观点与辩论准备。',
          'ps.gr46.section.focus': '重点训练',
          'ps.gr46.section.topics': '主题示例',
          'ps.gr46.focus': '<h3>重点训练</h3><ul><li>结构化说服演讲</li><li>用例子支持观点</li><li>对比不同立场</li><li>辩论导入技巧</li><li>Q&A 应对</li></ul>',
          'ps.gr46.topics': '<h3>主题示例</h3><ul><li>是否应该减少作业？</li><li>团队合作为什么重要</li><li>科技是帮助还是伤害？</li><li>环保责任</li></ul>',
          'ps.skills.title': '学生可获得的能力',
          'ps.skills.list': '<ul><li>舞台自信</li><li>清晰发音</li><li>逻辑组织</li><li>批判性思维</li><li>文化意识</li><li>学术词汇</li></ul>',
          'ps.why.title': '为什么演讲很重要',
          'ps.why.desc': '强表达者通常也是强写作者与强思考者。',
          'ps.why.list': '<ul><li>提升学业表现</li><li>强化写作能力</li><li>培养领导力</li><li>大学升学准备</li></ul>',
          'ps.format.title': '课程形式',
          'ps.format.list': '<ul><li>小班教学</li><li>主题引导与准备</li><li>每周演讲展示</li><li>个性化反馈</li><li>表现型进度记录</li></ul>',
          'ps.cta.primary': '咨询课程顾问',
          'ps.cta.secondary': '返回课程',
          'teachers.title': '我们的师资',
          'teachers.desc': '认识我们经验丰富、敬业的教师团队。',
          'teachers.t1.name': 'Mr. Daniel Huang（黄老师）',
          'teachers.t1.title': '英语项目',
          'teachers.t1.bio': '教育学研究生（Towson University），毕业于上海外国语大学。中加两地25+年语言教学经验，专长ESL/IELTS/TOEFL（曾任新东方讲师）。',
          'teachers.t2.name': 'Donald Qi 老师',
          'teachers.t2.title': '英语项目',
          'teachers.t2.bio': '早年毕业于上海复旦大学并留校任教英美文学，后获女王大学文学硕士及多伦多大学教育学博士学位。曾长期在多伦多教育局从事语言教学测评评估工作，并在加拿大多所大学学院教授学术写作。现任杜克学院资深教育咨询专家顾问与学术写作指导老师。',
          'teachers.t3.name': 'Maggie Chan 老师',
          'teachers.t3.title': '英语项目',
          'teachers.t3.bio': '毕业于加拿大西安大略大学经济学与语言系，持有加拿大语言教学 TESL 证书。现为杜克雅思与青少年读写 Reading Town 教学名师。拥有香港重点中学及加拿大多年留学与教育教学经验，教学耐心细致，专业敬业，深受中小学生喜爱。',
          'teachers.t4.name': 'Dr. Jovana Pokrajac',
          'teachers.t4.title': '英语项目',
          'teachers.t4.bio': '英语本硕毕业于York University，并获University of Ottawa现代文学博士。曾任多所大学教授，加入Duke College 3+年，专长大学级学术写作与写作能力提升。',
          'teachers.t5.name': 'Ms. Chengyi Tang（唐老师）',
          'teachers.t5.title': '法语项目',
          'teachers.t5.bio': '蒙特利尔法语高校毕业，法语等级Band 10，IELTS 8.0（多伦多受训）。自2021年11月起担任Duke College在线法语老师，深受青少年学生喜爱。',
          'teachers.t6.name': 'Ms. Maria Carbajal',
          'teachers.t6.title': 'ESL项目',
          'teachers.t6.bio': 'Queen\'s University文学学士（BAH），International Baccalaureate毕业。自2020年7月起在Duke Academy/Reading Town任教，擅长根据学生目标与水平定制个性化学习方案，课堂亲和、注重互动。',
          'teachers.t7.name': 'Ms. Gabby Richardson',
          'teachers.t7.title': '英语项目',
          'teachers.t7.bio': 'University of Guelph研究生，Reading Town专业英文写作导师；同时具备丰富线上ESL授课经验，擅长写作表达与语言基础提升。',
          'teachers.t8.name': 'Mr. Alireza Riasati',
          'teachers.t8.title': '英语项目',
          'teachers.t8.bio': '来加前为马来西亚高校语言教授，在Duke Academy任教3年。ESL专家与IELTS考官，擅长IELTS/TOEFL/CELPIP/Duolingo等语言考试系统备考。',
          'teachers.t9.name': 'Mr. Dara Sadeghi',
          'teachers.t9.title': '英语项目',
          'teachers.t9.bio': 'American Modern University研究生（地理与政治学方向），Duke College专业教师。10年教授青少年与成人ESL/IELTS/TOEFL/CELPIP经验，深受国际学生欢迎。',
          'nav.home': '首页',
          'nav.english': '英语',
          'nav.math': '数学',
          'nav.partners': '合作伙伴',
          'nav.life': '学生生活',
          'nav.contact': '联系',
          'hero.h1': 'Duke College Since 2009\n杜克学院——加拿大语言署的认证语言培训机构',
          'hero.p': '加拿大青少年专业读写品牌课程。',
          'btn.courses': '所有课程',
          'btn.signup': '点击报名',
          'about.title': '关于我们',
          'about.desc': '      Duke College 是一家专注于青少年英语 Reading&Writing（阅读与写作）能力培养的教育机构.我们致力于通过系统、科学、循序渐进的教学方式，帮助孩子建立扎实的阅读基础，提升写作表达能力，发展长期的学术学习能力。',
          'services.title': '课程',
          'services.desc': '选择您需要的服务并联系顾问获取课程详情与价格',
          'english.title': '英语课程',
          'english.desc': '根据不同学习阶段设计的系统化阅读与表达课程。',
          'english.section.easyStart': 'Easy Start',
          'english.section.easyChapterBooks': 'Easy Chapter Books',
          'english.section.vastReading': 'Vast Reading',
          'english.section.comprehensiveReading': 'Comprehensive Reading',
          'english.section.speedReading': 'Speed Reading',
          'english.section.powerPresentation': 'Power Presentation',
          'english.section.classicReading': 'Classic Reading',
          'english.back': '返回英语课程',
          'english.easyStart.title': 'Easy Start',
          'english.easyStart.desc': '面向低龄学习者的英语基础课程。',
          'english.easyStart.content': '<h3>课程重点</h3><ul><li>字母与发音启蒙</li><li>核心词汇与基础句型</li><li>日常口语与课堂表达</li><li>循序渐进的入门阅读训练</li></ul>',
          'english.easyChapterBooks.title': 'Easy Chapter Books',
          'english.easyChapterBooks.desc': '从绘本顺利过渡到初级章节书。',
          'english.easyChapterBooks.content': '<h3>课程重点</h3><ul><li>通过短篇章节书建立阅读耐力</li><li>理解情节、场景与人物基础</li><li>进行结构化复述与总结</li><li>通过语境学习提升词汇量</li></ul>',
          'english.vastReading.title': 'Vast Reading',
          'english.vastReading.desc': '通过多题材阅读拓展知识与表达。',
          'english.vastReading.content': '<h3>课程重点</h3><ul><li>广泛阅读小说与非虚构文本</li><li>培养独立阅读习惯</li><li>跨文本比较观点与信息</li><li>以分级目标跟踪阅读进度</li></ul>',
          'english.comprehensiveReading.title': 'Comprehensive Reading',
          'english.comprehensiveReading.desc': '融合阅读理解、分析与书面表达训练。',
          'english.comprehensiveReading.content': '<h3>课程重点</h3><ul><li>主旨与细节分析</li><li>推理与证据支持观点</li><li>结构化读后写作</li><li>批判性思维与论证表达</li></ul>',
          'english.speedReading.title': 'Speed Reading',
          'english.speedReading.desc': '在保证理解准确的前提下提升阅读速度。',
          'english.speedReading.content': '<h3>课程重点</h3><ul><li>通过计时阅读提升速度</li><li>在限时条件下保持理解力</li><li>快速抓取关键信息</li><li>提升考试场景阅读效率</li></ul>',
          'english.powerPresentation.title': 'Power Presentation',
          'english.powerPresentation.desc': '强化结构化表达与演讲呈现能力。',
          'english.powerPresentation.content': '<h3>课程重点</h3><ul><li>演讲结构：开场、主体、结尾</li><li>声音控制、节奏与听众互动</li><li>视觉辅助与讲稿要点使用</li><li>问答应对与舞台自信建立</li></ul>',
          'english.classicReading.title': 'Classic Reading',
          'english.classicReading.desc': '通过经典阅读提升语言深度与思辨能力。',
          'english.classicReading.content': '<h3>课程重点</h3><ul><li>经典文本精读训练</li><li>主题、语气与写作技巧分析</li><li>基于文本的讨论与论证</li><li>阅读与学术写作联动提升</li></ul>',
          'math.title': '数学',
          'math.desc': '从基础到竞赛的数学支持，按学生情况定制。',
          'math.gr12.view': '查看详情',
          'math.gr12.title': '一年级–二年级（单元）',
          'math.gr12.desc': '新加坡数学 Grade 1–2 课程单元概览。',
          'math.gr12.back': '返回数学',
          'math.gr34.view': '查看详情',
          'math.gr34.title': '三年级–四年级（单元）',
          'math.gr34.desc': '新加坡数学 Grade 3–4 课程单元概览。',
          'math.gr34.back': '返回数学',
          'math.gr56.view': '查看详情',
          'math.gr56.title': '五年级–六年级（单元）',
          'math.gr56.desc': '五年级–六年级课程单元概览。',
          'math.gr56.back': '返回数学',
          'math.gr12.group1': '单元 1–6',
          'math.gr12.group2': '单元 7–12',
          'math.gr12.group3': '单元 13–17',
          'math.gr34.group1': '单元 1–5',
          'math.gr34.group2': '单元 6–10',
          'math.gr34.group3': '单元 11–15',
          'math.gr56.group1': '单元 1–4',
          'math.gr56.group2': '单元 5–8',
          'math.gr56.group3': '单元 9–11',
          'math.gr12.unit1': '<h3>单元 1：1000以内的数</h3><ul><li>识读并书写1000以内数字（数字与文字）</li><li>认识1000以内数字的位值</li><li>比较与排列1000以内数字</li><li>完成数列规律</li></ul>',
          'math.gr12.unit2': '<h3>单元 2：1000以内的加法</h3><ul><li>进行1000以内的简单与心算加法</li><li>不进位加法</li><li>按个位、十位或百位进位的加法</li></ul>',
          'math.gr12.unit3': '<h3>单元 3：1000以内的减法</h3><ul><li>进行1000以内的简单与心算减法</li><li>不退位减法</li><li>按个位、十位或百位退位的减法</li><li>跨零减法</li></ul>',
          'math.gr12.unit4': '<h3>单元 4：加减法应用题</h3><ul><li>使用部分-整体关系进行加减</li><li>通过增加或减少集合进行加减</li><li>通过比较两个集合进行加减</li></ul>',
          'math.gr12.unit5': '<h3>单元 5：乘法与除法</h3><ul><li>用等量分组和重复加法表示乘法</li><li>通过平均分与等量分组理解除法</li><li>编写乘除法情境题</li></ul>',
          'math.gr12.unit6': '<h3>单元 6：2、5、10的乘除法</h3><ul><li>2的乘法表</li><li>5的乘法表</li><li>10的乘法表</li><li>交换顺序进行乘法</li><li>用乘法事实进行除法</li></ul>',
          'math.gr12.unit7': '<h3>单元 7：3和4的乘除法</h3><ul><li>3的乘法表</li><li>4的乘法表</li><li>交换顺序进行乘法</li><li>用乘法事实进行除法</li><li>写出乘除法事实家族</li></ul>',
          'math.gr12.unit8': '<h3>单元 8：乘除法应用题</h3><ul><li>解决乘法应用题</li><li>解决除法应用题</li></ul>',
          'math.gr12.unit9': '<h3>单元 9：长度</h3><ul><li>用米尺测量长、宽、高</li><li>以米为单位比较与排序</li><li>用厘米测量较短物体</li><li>以厘米为单位比较与排序</li><li>长度的加减</li><li>长度的乘除</li></ul>',
          'math.gr12.unit10': '<h3>单元 10：两步加减应用题</h3><ul><li>解决两步加减应用题</li></ul>',
          'math.gr12.unit11': '<h3>单元 11：质量</h3><ul><li>比较两个或多个物体的质量</li><li>用千克测量与比较</li><li>用克测量与比较</li><li>质量的加减</li><li>质量的乘除</li></ul>',
          'math.gr12.unit12': '<h3>单元 12：金钱</h3><ul><li>计算一组纸币和硬币的价值</li><li>找零（分与元）</li><li>比较金额</li><li>解决金钱相关应用题</li></ul>',
          'math.gr12.unit13': '<h3>单元 13：二维与三维图形</h3><ul><li>识别正方形、长方形、三角形、圆、半圆和四分之一圆</li><li>组合平面图形形成新图形</li><li>用点阵或方格纸画图形</li><li>识别立方体、长方体、圆锥、圆柱和球</li><li>组合立体图形形成新图形</li><li>用平面图形做规律</li><li>用立体图形做规律</li></ul>',
          'math.gr12.unit14': '<h3>单元 14：分数</h3><ul><li>理解分数表示等分</li><li>理解部分与整体</li><li>比较分数</li><li>排列分数</li><li>同分母分数加减</li></ul>',
          'math.gr12.unit15': '<h3>单元 15：时间</h3><ul><li>读写正确的时间</li><li>正确画时针与分针</li><li>正确使用am与pm</li><li>给定持续时间求之后时间（半小时或一小时）</li></ul>',
          'math.gr12.unit16': '<h3>单元 16：象形统计图</h3><ul><li>阅读并理解带刻度的象形统计图</li><li>制作带刻度的象形统计图</li></ul>',
          'math.gr12.unit17': '<h3>单元 17：体积</h3><ul><li>比较液体体积</li><li>以升为单位读数并测量液体体积</li><li>解决与体积加减乘除相关的应用题</li></ul>',
          'math.gr34.unit1': '<h3>单元 1：10万以内的数</h3><ul><li>数数并书写10万以内的数字与文字</li><li>理解10万以内数字的位值</li><li>比较与排列10万以内数字</li><li>完成数列规律</li><li>四舍五入到十位、百位和千位</li><li>估算和与差</li></ul>',
          'math.gr34.unit2': '<h3>单元 2：因数与倍数</h3><ul><li>列出因数和公因数</li><li>列出倍数和公倍数</li></ul>',
          'math.gr34.unit3': '<h3>单元 3：整数乘除</h3><ul><li>乘以一位数与两位数</li><li>除以一位数</li><li>估算乘除结果</li><li>检验答案是否合理</li></ul>',
          'math.gr34.unit4': '<h3>单元 4：整数应用题</h3><ul><li>解决最多三步的应用题</li></ul><p style="margin: 10px 0 0; color: var(--muted); font-size: 14px;">非常规问题 1 — 启发式：前后对比概念；应用题</p>',
          'math.gr34.unit5': '<h3>单元 5：角</h3><ul><li>理解并测量角</li><li>作图到180°</li><li>理解转向与八方位</li></ul>',
          'math.gr34.unit6': '<h3>单元 6：正方形与长方形</h3><ul><li>识别正方形与长方形的性质</li><li>求正方形与长方形的未知边长</li><li>求正方形与长方形的未知角</li><li>作图正方形与长方形</li></ul>',
          'math.gr34.unit7': '<h3>单元 7：对称</h3><ul><li>识别对称图形</li><li>找出对称轴</li><li>补全对称图形与图案</li></ul>',
          'math.gr34.unit8': '<h3>单元 8：分数</h3><ul><li>识别带分数与假分数</li><li>带分数与假分数互化</li><li>比较与排列分数</li><li>理解集合的分数</li></ul>',
          'math.gr34.unit9': '<h3>单元 9：分数加减</h3><ul><li>分数加减</li><li>分数加减相关应用题</li></ul>',
          'math.gr34.unit10': '<h3>单元 10：小数</h3><ul><li>理解十分位、百分位与千分位</li><li>比较与排列小数</li><li>四舍五入到整数、1位或2位小数</li><li>分数与小数互化</li></ul>',
          'math.gr34.unit11': '<h3>单元 11：小数四则运算</h3><ul><li>小数加减</li><li>小数乘除</li><li>估算小数值</li><li>检验答案是否合理</li></ul>',
          'math.gr34.unit12': '<h3>单元 12：小数应用题</h3><ul><li>解决小数相关应用题</li></ul>',
          'math.gr34.unit13': '<h3>单元 13：面积与周长</h3><ul><li>计算矩形、正方形与组合图形的周长和面积</li><li>已知周长/面积求长或宽</li><li>解决周长与面积应用题</li></ul>',
          'math.gr34.unit14': '<h3>单元 14：表格与折线图</h3><ul><li>阅读并理解表格数据</li><li>根据给定数据补全表格</li><li>利用折线图解决问题</li></ul>',
          'math.gr34.unit15': '<h3>单元 15：时间</h3><ul><li>用秒表示时间</li><li>12小时制与24小时制</li><li>求两个时间的持续时间</li><li>已知持续时间求起始或结束时间</li><li>解决时间相关应用题</li></ul>',
          'math.gr56.unit1': '<h3>单元 1：代数</h3><ul><li>用字母表示未知数</li><li>代数式的化简与求值</li><li>解决代数相关应用题</li></ul>',
          'math.gr56.unit2': '<h3>单元 2：分数</h3><ul><li>分数除以整数</li><li>整数除以真分数</li><li>真分数除以真分数</li><li>解决分数相关应用题</li></ul>',
          'math.gr56.unit3': '<h3>单元 3：比率</h3><ul><li>比率与分数的关系</li><li>比较比率</li><li>解决比率相关应用题</li></ul>',
          'math.gr56.unit4': '<h3>单元 4：百分数</h3><ul><li>求百分数</li><li>求百分比变化</li><li>解决与百分比、折扣、GST、百分比增减相关应用题</li></ul>',
          'math.gr56.unit5': '<h3>单元 5：圆</h3><ul><li>识别圆心、半径、直径、周长，以及半圆与四分之一圆</li><li>使用公式计算圆的周长与面积</li><li>计算组合图形的周长与面积</li><li>解决圆与组合图形相关应用题</li></ul>',
          'math.gr56.unit6': '<h3>单元 6：几何图形中的角</h3><ul><li>计算正方形、长方形、平行四边形、菱形、梯形及不同类型三角形的未知角</li></ul>',
          'math.gr56.unit7': '<h3>单元 7：速度</h3><ul><li>理解路程与速度</li><li>求平均速度</li><li>解决速度相关应用题</li></ul>',
          'math.gr56.unit8': '<h3>单元 8：固体与液体体积</h3><ul><li>使用计算器求平方根与立方根</li><li>计算立体的体积</li><li>已知体积求立方体边长</li><li>已知体积及其余尺寸求长方体某一尺寸</li><li>求固体与液体的高、表面积与体积</li><li>解决体积相关应用题</li></ul>',
          'math.gr56.unit9': '<h3>单元 9：饼图</h3><ul><li>阅读与解释饼图</li></ul>',
          'math.gr56.unit10': '<h3>单元 10：立体图形与展开图</h3><ul><li>识别不同类型的立体</li><li>识别并说明立方体、长方体、棱柱和棱锥的面数</li><li>识别立体（如立方体、长方体、棱柱、棱锥）的展开图</li><li>根据展开图识别立体</li></ul>',
          'math.gr56.unit11': '<h3>单元 11：挑战性应用题</h3><ul><li>解决与整数、分数、小数、比率、百分比与速度相关的应用题</li></ul>',
          'contests.title': '数学竞赛',
          'contests.desc': '五个重点竞赛的时间与特点概览。',
          'contest.back': '返回数学',
          'contest.eligibility': '适合年级',
          'contest.exam': '考试时间',
          'contest.features': '竞赛特点',
          'contest.kangaroo.card.title': 'Math Kangaroo Canada',
          'contest.kangaroo.card.desc': '国际数学竞赛，题目趣味性强。',
          'contest.beaver.card.title': 'Beaver Computing Challenge',
          'contest.beaver.card.desc': '计算思维与逻辑推理，不要求编程。',
          'contest.mc.card.title': 'Mathematica Centrum Contest',
          'contest.mc.card.desc': '加拿大本土竞赛，难度递进明显。',
          'contest.amc8.card.title': 'AMC 8',
          'contest.amc8.card.desc': '25道选择题，强调高阶思维。',
          'contest.amc10_12.card.title': 'AMC 10 / AMC 12',
          'contest.amc10_12.card.desc': '通往AIME的重要路径。',
          'contest.kangaroo.title': 'Math Kangaroo Canada',
          'contest.kangaroo.desc': '国际数学竞赛，以趣味性和思维性著称。',
          'contest.kangaroo.range': '适合年级：G1–G12',
          'contest.kangaroo.grades': '适合年级：G1–G12',
          'contest.kangaroo.groups': '主要组别：G1–2 / G3–4 / G5–6 / G7–8 / G9–10 / G11–12',
          'contest.kangaroo.time': '每年 3月（March）',
          'contest.kangaroo.feature1': '国际数学竞赛',
          'contest.kangaroo.feature2': '趣味性与思维性题目',
          'contest.kangaroo.feature3': '强调逻辑推理与策略思考',
          'contest.kangaroo.feature4': '非课本型题目',
          'contest.beaver.title': 'Beaver Computing Challenge',
          'contest.beaver.desc': '偏向计算思维与信息处理的竞赛。',
          'contest.beaver.range': '适合年级：G2–G12',
          'contest.beaver.grades': '适合年级：G2–G12',
          'contest.beaver.time': '每年 11月（November）',
          'contest.beaver.feature1': '偏向计算思维（Computational Thinking）',
          'contest.beaver.feature2': '逻辑推理与信息处理',
          'contest.beaver.feature3': '适合数学基础较好的学生',
          'contest.beaver.feature4': '不需要编程基础',
          'contest.mc.title': 'Mathematica Centrum Contest',
          'contest.mc.desc': '加拿大本土竞赛，强调数感与解题能力。',
          'contest.mc.range': '适合年级：G1–G8',
          'contest.mc.grades': '适合年级：G1–G8',
          'contest.mc.time': '每年 4月（April）',
          'contest.mc.feature1': '加拿大本土竞赛',
          'contest.mc.feature2': '强调数感与解题能力',
          'contest.mc.feature3': '题型难度递进明显',
          'contest.mc.feature4': '适合系统训练学生',
          'contest.amc8.title': 'AMC 8',
          'contest.amc8.desc': '美国数学竞赛体系的重要起点。',
          'contest.amc8.range': '适合年级：G8及以下',
          'contest.amc8.grades': '适合年级：G8及以下',
          'contest.amc8.time': '每年 1月（January）',
          'contest.amc8.feature1': '美国数学竞赛体系',
          'contest.amc8.feature2': '25题选择题',
          'contest.amc8.feature3': '注重高阶思维与策略',
          'contest.amc8.feature4': '竞赛数学重要起点',
          'contest.amc10_12.title': 'AMC 10 / AMC 12',
          'contest.amc10_12.desc': '进入 AIME 的重要路径。',
          'contest.amc10_12.range': 'AMC 10：G10及以下；AMC 12：G12及以下',
          'contest.amc10_12.grades': 'AMC 10：G10及以下；AMC 12：G12及以下',
          'contest.amc10_12.time': '每年 11月（November）',
          'contest.amc10_12.feature1': '进入 AIME 的重要路径',
          'contest.amc10_12.feature2': '高强度逻辑与代数推理',
          'contest.amc10_12.feature3': '申请北美顶尖大学的重要加分项',
          'math.track1.title': '基础数学',
          'math.track1.item1.title': '1-2 年级',
          'math.track1.item1.desc': '数感、代数基础与解题训练。',
          'math.track1.item2.title': '3-4 年级',
          'math.track1.item2.desc': '每周辅导强化课堂学习。',
          'math.track1.item3.title': '5-6 年级',
          'math.track2.title': '提升课程',
          'math.track2.item1.title': '进阶专题',
          'math.track2.item1.desc': '挑战题、逻辑训练与竞赛技巧。',
          'math.track2.item2.title': '竞赛备考',
          'math.track2.item2.desc': 'AMC/加拿大竞赛训练与模拟测试。',
          'math.track3.title': '高中课程',
          'math.track3.item1.title': '学分课程',
          'math.track3.item1.desc': '函数、进阶函数与微积分预备。',
          'math.track3.item2.title': '考试辅导',
          'math.track3.item2.desc': '针对性复习与应试策略。',
          'partners.title': '合作伙伴',
          'partners.desc': '与我们关系密切的合作伙伴',
          'life.title': '每月活动',
          'life.desc': '过往活动展示',
          'testimonials.title': '学员与家长的感言',
          'contact.title': '联系我们',
          'link.view': '查看详情',
          'cat.k12.title': '英文读写课程',
          'cat.esl.title': '加拿大ESL课程',
          'cat.tests.title': '语言考试培训课程',
          'cat.ps.title': '公共演讲课程',
          'cat.math.title': '数学课程',
          'cat.others.title': '其它课程',
          'svc.jump.title': 'Jump Start (K–G2)',
          'svc.jump.desc': '语音和早期阅读基础，包含分班测试和每周进度记录。',
          'svc.readingclub.title': 'Reading Club (G2–G8)',
          'svc.readingclub.desc': '分级指导阅读，提高流利度、理解力与词汇量。',
          'svc.classic.title': 'Classic Reading (G9–G12)',
          'svc.classic.desc': '精读与文学分析，帮助学生为高年级课程和考试做准备。',
          'svc.academicwriting.title': 'Academic Writing (G8–G12)',
          'svc.academicwriting.desc': '实用论文与研究写作技能，提供针对性反馈以提升能力。',
          'svc.publicspeaking.title': 'Public Speaking (G4–G8)',
          'svc.publicspeaking.desc': '短时演讲练习，培养自信、表达清晰与发音。',
          'svc.youth.title': 'Youth ESL',
          'svc.youth.desc': '互动式青少年项目，结合语言学习、文化活动与领导力培养。',
          'svc.highschool.title': 'High School ESL',
          'svc.highschool.desc': '面向高中生的综合ESL课程，侧重学术词汇、阅读理解与考试准备。',
          'svc.adult.title': 'Adult ESL',
          'svc.adult.desc': '面向成人的实用英语课程，强调职场沟通、会话与专业写作。',
          'svc.ielts.title': 'IELTS',
          'svc.ielts.desc': '针对IELTS四项（听说读写）的强化训练，提升分数。',
          'svc.toefl.title': 'TOEFL',
          'svc.toefl.desc': '针对学术英语与考试技巧的TOEFL备考课程。',
          'svc.celpip.title': 'CELPIP',
          'svc.celpip.desc': 'CELPIP练习模块与计时模拟测试，提升速度与准确性。',
          'svc.duolingo.title': 'Duolingo',
          'svc.duolingo.desc': '精简的Duolingo考题训练与自适应练习，快速提升。',
          'svc.other.title': 'Other Tests',
          'svc.other.desc': '可按需定制其他英语能力考试的备考服务。',
          'life.event1.title': '口语演讲颁奖阶段',
          'life.event1.desc': '表彰优秀演讲与口语能力的学生颁奖典礼。',
          'life.event1.imgAlt': '口语演讲颁奖',
          'life.event2.title': '口语演讲优秀学生',
          'life.event2.desc': '表彰在口语课程中表现突出的学生，他们展现了非凡的自信与表达能力。',
          'life.event2.imgAlt': '优秀学生',
          'life.event3.title': '秋季活动 – 火车博物馆参观',
          'life.event3.desc': '教育性外出活动，探索铁路历史与文化展览。',
          'life.event3.imgAlt': '火车博物馆参观',
          'life.event4.title': '枫糖节活动',
          'life.event4.desc': '春季实地活动，体验枫糖节文化与主题学习，提升学生观察与表达能力。',
          'life.event4.imgAlt': '枫糖节活动',
          'life.event5.title': '读书与演讲报告',
          'life.event5.desc': '学生在舞台上展示阅读成果，通过读书分享与演讲训练，提升理解力、自信表达与逻辑思维能力。',
          'life.event5.imgAlt': '读书与演讲报告',
          'about.cert': '加拿大杜克英语ESL学习能力认证',
          'about.highlights.title': '亮点速览',
          'about.highlights.li1': '✅ 语言学习中心：K-12 阅读与写作课程 / ESL / 考试备考',
          'about.highlights.li2': '✅ 高中学习辅导：学分提升 / 快修学科辅导',
          'about.highlights.li3': '✅ 竞赛和兴趣活动培训：加拿大各级数学竞赛 / 音乐学习 / 机器人课程',
          'testi.1.quote': '"虽然英语是我们家庭的母语，但 Duke College 在学术写作方面给予了孩子非常系统和深入的训练，这是学校课堂上难以做到的。通过书评写作和课堂讨论，他逐渐建立了更清晰的逻辑结构和真正的分析能力。"',
          'testi.1.author': '— 本地学生家长（五年级，非 ESL）',
          'testi.2.quote': '"以前我觉得读书很无聊。现在我很喜欢读完章节书，因为我们会讨论人物、主题和更深层的意义，而不仅仅是故事情节。写书评也比以前轻松，而且更有条理了"',
          'testi.2.author': '— 六年级学生',
          'testi.3.quote': '"分级阅读体系非常系统。孩子从绘本一步一步过渡到初级章节书，过程自然、有节奏。整个进步是稳定而且看得见的，我们非常放心。"',
          'testi.3.author': '— 三年级 ESL 学生家长',
          'label.email': '您的邮箱',
          'placeholder.email': 'you@example.com',
          'label.name': '姓名',
          'placeholder.first': '名',
          'placeholder.last': '姓',
          'label.message': '问题 / 需求',
          'placeholder.message': '请简单描述你的需求...',
          'btn.submit': '提交',
          'contact.info.title': '联系方式',
          'contact.info.content': '📧 dukecollege8@gmail.com<br/>☎︎ (905) 569‑0511<br/>☎︎ (647) 987‑2623<br/>📍 250 Ferrier St, Markham, ON L3R 2Z5',
          'contact.info.hours': '工作时间：周一至周六 10:00–20:00',
          'contact.qr.title': '扫码联系我们',
          'contact.qr.desc': '使用微信扫描二维码，获取最新课程信息和报名方式',
          'downloads.title': '下载',
          'downloads.sample': '课表示例.pdf',
          'downloads.guardian': '监护服务手册.pdf',
          'footer.copy': 'Duke College And Business Technology · All rights reserved',
          'topbar.contact': '📧 dukecollege8@gmail.com · ☎︎ (905) 569‑0511 · ☎︎ (647) 987‑2623',
          'social.facebook': 'Facebook',
          'social.instagram': 'Instagram',
          'partner.a': '雅思',
          'partner.b': '思培',
          'partner.c': 'VIP 教学',
          'partner.d': '西安大略大学',
          'partner.e': '东安教育服务',
          'partner.f': ' 加拿大国际留学生服务中心',
          'partner.g': '加中教育文化交流协会',
          'partner.h': '多伦多大学',
          'partner.i': '麦吉尔大学',
          'partner.j': '滑铁卢大学',
          'partner.k': '加拿大圣文森山大学杜克学院语言课程直通车',
          'partner.l': '国际学术英语预备中心（多伦多）',
          'partner.m': '苏汉辉加拿大移民法律事务所',
          'partner.n': '加拿大博大移民留学',
          'partner.o': '加拿大荣耀移民留学',
          'partner.p': '美国美桥留学顾问博士工作室',
          'partner.q': '多伦多星音乐学校',
          'partner.r': '万锦击剑俱乐部',
          'partner.s': '加拿大中文教育协会'
        }
      };

      // Apply a language across the whole page: walks every data-i18n* element
      // and swaps text / placeholder / alt / src / innerHTML, persists the
      // choice to localStorage('site-lang'), and fires a 'languageChanged' event
      // so other widgets (e.g. office hours) can re-render.
      function setLang(lang){
        console.debug('setLang:', lang);
        const items = document.querySelectorAll('[data-i18n]');
        items.forEach(el => {
          const key = el.getAttribute('data-i18n');
          const text = translations[lang] && translations[lang][key];
          if(text === undefined){
            console.warn('i18n: missing key', key, 'for lang', lang, el);
            return;
          }
          // preserve <br> if present in hero.h1
          if(key === 'hero.h1' && text.includes('\n')){
            el.innerHTML = text.split('\n').map((s,i)=> i? '<br>'+escapeHtml(s): escapeHtml(s)).join('');
            console.debug('i18n: set innerHTML', key, text);
          } else {
            // if element contains inline tags (e.g. <strong>), set textContent for safety
            el.textContent = text;
            console.debug('i18n: set textContent', key, text);
          }
        });

        // placeholders
        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
          const key = el.getAttribute('data-i18n-placeholder');
          const text = translations[lang] && translations[lang][key];
          if(text !== undefined) el.placeholder = text;
        });

        // alt attributes for images
        const alts = document.querySelectorAll('[data-i18n-alt]');
        alts.forEach(el => {
          const key = el.getAttribute('data-i18n-alt');
          const text = translations[lang] && translations[lang][key];
          if(text !== undefined) el.alt = text;
        });

        // src attributes for language-specific images (e.g. teachers)
        const i18nImages = document.querySelectorAll('[data-i18n-src-zh], [data-i18n-src-en]');
        i18nImages.forEach(img => {
          const defaultSrc = img.getAttribute('data-i18n-src-default') || img.getAttribute('src');
          if (!img.getAttribute('data-i18n-src-default') && defaultSrc) {
            img.setAttribute('data-i18n-src-default', defaultSrc);
          }
          const targetSrc = img.getAttribute(`data-i18n-src-${lang}`);
          if (targetSrc) {
            img.src = targetSrc;
          } else if (defaultSrc) {
            img.src = defaultSrc;
          }
        });

        // html content (for contact info with line breaks)
        const htmls = document.querySelectorAll('[data-i18n-html]');
        htmls.forEach(el => {
          const key = el.getAttribute('data-i18n-html');
          const text = translations[lang] && translations[lang][key];
          if(text !== undefined) el.innerHTML = text;
        });

        localStorage.setItem('site-lang', lang);
        const enBtn = document.getElementById('lang-en');
        const zhBtn = document.getElementById('lang-zh');
        if(enBtn) enBtn.classList.toggle('active', lang === 'en');
        if(zhBtn) zhBtn.classList.toggle('active', lang === 'zh');

        currentLang = lang;
        
        // Dispatch custom event for language change
        window.dispatchEvent(new Event('languageChanged'));
      }

      // Pick the language on load: saved preference wins, else fall back to the
      // browser language (zh* -> Chinese, otherwise English).
      function ensureLang(){
        const saved = localStorage.getItem('site-lang');
        const fallback = (navigator.language && navigator.language.startsWith('zh')) ? 'zh' : 'en';
        const lang = saved || fallback;
        if(lang !== currentLang) setLang(lang);
      }

      // Escape user-facing text before inserting as innerHTML (used for hero.h1).
      function escapeHtml(str){
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      // Everything below wires up the DOM once it has finished parsing.
      document.addEventListener('DOMContentLoaded', function(){
        // Language switch buttons in the top bar.
        const enBtn = document.getElementById('lang-en');
        const zhBtn = document.getElementById('lang-zh');
        if(enBtn) enBtn.addEventListener('click', ()=> setLang('en'));
        if(zhBtn) zhBtn.addEventListener('click', ()=> setLang('zh'));

        // Partners carousel: show ~5 logos, advance one at a time. Widths are
        // measured at runtime so the step matches the rendered card + gap, and
        // it re-measures on resize. Sets data-enhanced="true" (see styles.css).
        (function initPartners(){
          const partnersEl = document.querySelector('#partners .partners');
          const track = partnersEl ? partnersEl.querySelector('.partners-track') : null;
          const prevBtn = document.getElementById('partners-prev');
          const nextBtn = document.getElementById('partners-next');
          if(!partnersEl || !track || !prevBtn || !nextBtn) return;

          const items = Array.from(track.querySelectorAll('.partner'));
          const total = items.length;
          let visibleCount = 5;
          let maxIndex = Math.max(0, total - visibleCount);
          let index = 0;
          let stepPx = 0;

          partnersEl.setAttribute('data-enhanced', 'true');

          function getGapPx(){
            const cs = window.getComputedStyle(track);
            const gap = cs.gap || cs.columnGap || '0px';
            const parsed = parseFloat(gap);
            return Number.isFinite(parsed) ? parsed : 0;
          }

          function measure(){
            const first = items[0];
            if(!first) { stepPx = 0; return; }
            const gap = getGapPx();
            stepPx = first.getBoundingClientRect().width + gap;
            if(stepPx > 0){
              visibleCount = Math.max(1, Math.floor((partnersEl.clientWidth + gap) / stepPx));
              maxIndex = Math.max(0, total - visibleCount);
            }
          }

          function updateButtons(){
            const disable = total <= visibleCount;
            prevBtn.disabled = disable || index <= 0;
            nextBtn.disabled = disable || index >= maxIndex;
          }

          function render(){
            if(stepPx <= 0) measure();
            track.style.transform = `translateX(${-index * stepPx}px)`;
            updateButtons();
          }

          function setIndex(nextIndex){
            index = Math.min(maxIndex, Math.max(0, nextIndex));
            render();
          }

          prevBtn.addEventListener('click', () => setIndex(index - 1));
          nextBtn.addEventListener('click', () => setIndex(index + 1));
          window.addEventListener('resize', () => { measure(); render(); });

          measure();
          render();
        })();
        // Mobile hamburger menu + hash-based router.
        const menuToggle = document.getElementById('menu-toggle');
        const siteMenu = document.getElementById('site-menu');

        // Hash router: "#/route" shows the matching <main data-route>, and the
        // optional "#/home/anchor" second segment scrolls to a section on home.
        function setRouteFromHash(){
          // Ensure correct language is applied on every route change.
          ensureLang();

          const raw = window.location.hash || '#/home';
          const match = raw.match(/^#\/([^\/]+)(?:\/([^\/]+))?/);
          const route = match && match[1] ? match[1] : 'home';
          const anchor = match && match[2] ? match[2] : null;

          document.querySelectorAll('.page').forEach(page => {
            const isActive = page.getAttribute('data-route') === route;
            page.classList.toggle('active', isActive);
            page.setAttribute('aria-hidden', isActive ? 'false' : 'true');
          });

          if(route === 'home' && anchor){
            requestAnimationFrame(() => {
              const el = document.getElementById(anchor);
              if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
        function closeMobile(){
          if(!menuToggle || !siteMenu) return;
          menuToggle.setAttribute('aria-expanded','false');
          siteMenu.classList.remove('open');
          siteMenu.setAttribute('aria-hidden','true');
        }
        function openMobile(){
          if(!menuToggle || !siteMenu) return;
          menuToggle.setAttribute('aria-expanded','true');
          siteMenu.classList.add('open');
          siteMenu.setAttribute('aria-hidden','false');
        }
        if(menuToggle && siteMenu){
          menuToggle.addEventListener('click', function(e){
            const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
            if(expanded) closeMobile(); else openMobile();
            e.stopPropagation();
          });
          // close when clicking outside
          document.addEventListener('click', function(ev){
            if(!siteMenu.classList.contains('open')) return;
            if(ev.target === menuToggle || siteMenu.contains(ev.target)) return;
            closeMobile();
          });
          // close on resize to larger screens
          window.addEventListener('resize', function(){ if(window.innerWidth > 767) closeMobile(); });
          // ensure each mobile link closes menu on click
          siteMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=> closeMobile()));
        }
        window.addEventListener('hashchange', setRouteFromHash);
        setRouteFromHash();
        // Apply language on initial load too.
        ensureLang();
        // Live "Open now / Closed" badge for the contact section. Recomputes
        // from the visitor's local clock, refreshes every minute, and re-renders
        // when the language changes. (Closed Sundays; Mon–Sat 10:00–20:00.)
        (function updateOfficeHours(){
          const hoursEl = document.getElementById('office-hours-display');
          if(!hoursEl) return;

          const updateHours = () => {
            const now = new Date();
            const day = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
            const currentLang = localStorage.getItem('site-lang') || 'zh';
            
            // Define office hours for each day
            const schedule = {
              0: null, // Sunday - Closed
              1: { start: 10, end: 20 }, // Monday 10:00-20:00
              2: { start: 10, end: 20 }, // Tuesday
              3: { start: 10, end: 20 }, // Wednesday
              4: { start: 10, end: 20 }, // Thursday
              5: { start: 10, end: 20 }, // Friday
              6: { start: 10, end: 20 }  // Saturday
            };
            
            const dayHours = schedule[day];
            
            if(dayHours === null) {
              // Closed today
              hoursEl.textContent = currentLang === 'zh' 
                ? '今日休息 | 周一至周六 10:00–20:00' 
                : 'Closed Today | Mon–Sat 10:00–20:00';
              hoursEl.style.color = '#999';
            } else {
              // Open today
              const hours = now.getHours();
              const isOpen = hours >= dayHours.start && hours < dayHours.end;
              const status = isOpen 
                ? (currentLang === 'zh' ? '营业中' : 'Open Now')
                : (currentLang === 'zh' ? '已打烊' : 'Closed');
              
              hoursEl.textContent = currentLang === 'zh'
                ? `工作时间：周一至周六 10:00–20:00 (${status})`
                : `Office Hours: Mon–Sat 10:00–20:00 (${status})`;
              hoursEl.style.color = isOpen ? '#28a745' : '#999';
            }
          };
          
          updateHours();
          // Update every minute
          setInterval(updateHours, 60000);
          
          // Update when language changes
          window.addEventListener('languageChanged', updateHours);
        })();
        
        // Dev-only sanity check: logs translation keys that are referenced in
        // the markup but missing from a locale (or defined but unused). Purely
        // diagnostic console output — has no effect on what the visitor sees.
        (function checkI18nParity(){
          try{
            const attrs = ['data-i18n','data-i18n-placeholder','data-i18n-alt','data-i18n-html'];
            const markupKeys = new Set();
            attrs.forEach(attr => document.querySelectorAll('['+attr+']').forEach(el => {
              const k = el.getAttribute(attr);
              if(k) markupKeys.add(k);
            }));

            const locales = Object.keys(translations || {});
            locales.forEach(locale => {
              const tKeys = new Set(Object.keys(translations[locale] || {}));
              const missing = [...markupKeys].filter(k => !tKeys.has(k));
              const unused = [...tKeys].filter(k => !markupKeys.has(k));
              if(missing.length) console.warn('i18n-parity: missing keys for', locale, missing);
              else console.debug('i18n-parity: no missing keys for', locale);
              if(unused.length) console.debug('i18n-parity: unused translation keys for', locale, unused.slice(0,20), unused.length>20? '...':'');
            });
          }catch(e){ console.error('i18n-parity: error', e); }
        })();
      });
    })();

    /* 4. Contact form -> Web3Forms.
     *    Submits via fetch (AJAX) so the visitor stays on the page, then shows a
     *    bilingual success/error message. The form's access_key (in index.html)
     *    must be a real key from web3forms.com for submissions to be delivered. */
    (function initContactForm(){
      document.addEventListener('DOMContentLoaded', function(){
        const form = document.getElementById('contact-form');
        if(!form) return;
        const status = document.getElementById('form-status');
        // Tiny helper: return the zh or en string for the current language.
        const msg = (zh, en) => (localStorage.getItem('site-lang') || 'zh') === 'zh' ? zh : en;
        const setStatus = (text, color) => { if(status){ status.textContent = text; status.style.color = color || ''; } };

        form.addEventListener('submit', async function(e){
          e.preventDefault(); // handle it ourselves instead of a full page POST
          const submitBtn = form.querySelector('[type="submit"]');
          if(submitBtn) submitBtn.disabled = true;
          setStatus(msg('提交中…', 'Sending…'), '#6b7280');

          try {
            const res = await fetch(form.action, {
              method: 'POST',
              headers: { 'Accept': 'application/json' },
              body: new FormData(form)
            });
            const data = await res.json().catch(() => ({}));
            if(res.ok && data.success){
              form.reset();
              setStatus(msg('提交成功，我们会尽快与您联系！', 'Thank you! Your message has been sent.'), '#28a745');
            } else {
              setStatus(msg('提交失败，请稍后再试或直接邮件联系我们。', 'Submission failed. Please try again or email us directly.'), '#d33');
            }
          } catch(err){
            setStatus(msg('网络错误，请稍后再试。', 'Network error. Please try again later.'), '#d33');
          } finally {
            if(submitBtn) submitBtn.disabled = false;
          }
        });
      });
    })();
