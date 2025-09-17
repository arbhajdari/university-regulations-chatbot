const { OpenAI } = require('openai');

// Initialize OpenAI lazily to allow environment variables to load first
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

// Clean university policies from your text data
const universityPolicies = {
  semesters: {
    title: "Academic Calendar and Semesters",
    content: "There are two semesters in an academic year; the Autumn semester starts within the first week of October and the Spring Semester starts at the end of February. Specific dates are published during the Spring semester of the previous academic year. Each semester has 15 weeks (12 weeks of classes and 3 weeks for revision and assessments). There is a break between semesters, which normally lasts two weeks."
  },
  
  academic_structure: {
    title: "Academic Structure & Assessment Overview",
    content: "Each academic year consists of two semesters (Autumn: Oct–Feb, Spring: Mar–Jun), each lasting 15 weeks. This includes 10 weeks of lectures, 1 consolidation week, 1 reading week, and 3 weeks for revision and assessments. Each semester offers multiple modules (courses). Undergraduate programmes are split into stages: 3-year UG has Stage 1 (Year 1), Stage 2 (Year 2), Stage 3 (Year 3). 4-year UG has Stage 1 (Years 1 & 2), Stage 2 (Year 3), Stage 3 (Year 4). Modules are units of study with titles, credit values, and assessments. Each credit equals 10 hours of total work (e.g., a 10-credit module = 100 hours). Credit levels (e.g., 4, 5, 6) indicate depth and complexity."
  },

  assessment_types: {
    title: "Assessment Types and Methods",
    content: "Assessment types include: Portfolio (collection of documents showing work on a topic), Essay/Report (includes literature reviews, case studies, and proposals), Project (planned individual or group work like lab reports, practicum), Self-Reflection (personal insights and learning reflection), Presentation (poster, in-class, or recorded demo to an audience), Tests/Quizzes (short exams like MCQs or exercises), Assessed Labs (practical exams in a lab setting), Final Exam (major exam at semester end, minimum 2 hours), Oral Exam (spoken assessment such as a viva)."
  },

  marking_scheme: {
    title: "Marking Scheme and Class Descriptors",
    content: "Marks range from 0–100. A minimum of 40 is needed to pass. Marking criteria: 70–100 (First Class: Excellent analysis, structure, research, and referencing), 60–69 (Second Class Upper 2:1: Strong understanding and use of sources), 50–59 (Second Class Lower 2:2: Basic analysis with some gaps), 40–49 (Third Class: Weak understanding, limited research), 1–39 (Fail: Poor or no understanding and analysis), 0 (No submission or academic misconduct). Final degree classification is based on Stages 2 and 3, weighted 2:3 respectively."
  },

  feedback_policy: {
    title: "Feedback and Syllabus Information",
    content: "Feedback types: Formative (ongoing feedback like comments in class), Summative (final grade and written feedback after assessment). Feedback is usually given within 3 weeks. Keep a copy; coursework is not returned. Each module has a syllabus with aims, content, methods, and assessment details, provided via Google Classroom."
  },

  coursework_submission: {
    title: "Coursework Submission and Deadlines",
    content: "Work is submitted via TurnItIn with a cover sheet, using your student ID only (no names). Once submitted, it cannot be edited. Deadlines are strict: 10 marks deducted per late day (up to 5 days), after 5 days = mark of zero. Extensions are granted only for serious reasons (e.g., illness with proof). Technical issues or workload pressure are not valid excuses. Always back up your work."
  },

  examination_process: {
    title: "Final Examination Process and Procedures",
    content: "Final closed exams usually take place during weeks 13 to 15 of each semester. Resit exams are held in September. The exact dates are published in advance. Most students write their answers by hand in university-provided booklets, but students with approved needs may use a computer. Exams are monitored (invigilated). Students with disabilities or specific conditions may request individual arrangements, but these must be made at least six weeks before the exam date."
  },

  progression_rules: {
    title: "Academic Progression Requirements",
    content: "To move to the next stage or graduate, you must pass all modules in the current stage. A pass requires a weighted average of at least 40% across the module's components (e.g. exams and coursework). You may still progress through either compensation or reassessment if you fail modules."
  },

  compensation_rules: {
    title: "Module Compensation Rules",
    content: "For Stage 1 and 2: You may still earn credits for a failed module (30–39%) if you have failed no more than 40 credits, no individual module mark is below 30, and your overall weighted average is at least 40. For Stage 3: You may receive credit if you have failed no more than 40 credits, no module mark is below 10, and your overall weighted average is at least 40. Even if compensation is granted, it's recommended to resit failed modules to avoid issues with degree recognition or further study."
  },

  reassessment_rules: {
    title: "Reassessment and Resit Rules",
    content: "Stage 1 & 2: You may be reassessed in up to 90 credits, but no more than 50 credits may be below 30. Stage 3: Reassessment allowed in up to 40 credits. You are allowed only one reassessment attempt per module. Not all modules allow reassessment — this is stated in the module syllabus. Reassessment is usually component-based (e.g., retaking only the failed part). The Board of Examiners decides which components need to be reassessed. Reassessment is held in September. The original attempt's mark is used in your final degree calculation (not the resit mark)."
  },

  graduation_requirements: {
    title: "Graduation Requirements and Classification",
    content: "To graduate, you must earn: 360 credits for a 3-year programme, 480 credits for a 4-year programme. Your degree classification is based on credit-weighted averages from Stages 2 and 3, with Stage 2 weighted 2 and Stage 3 weighted 3. Classification by Final Average Score: First-Class Honours (70–100), Upper Second-Class Honours 2:1 (60–69), Lower Second-Class Honours 2:2 (50–59), Third-Class Honours (40–49)."
  },

  class_schedules: {
    title: "Class Schedules and Attendance Requirements",
    content: "You'll receive your class schedule about a week before the semester starts, including module names, times, durations, and classroom locations. Classes are spread across weekdays and the schedule is available electronically. Attendance is mandatory. You are expected to attend all lectures, tutorials, and labs, starting from the first week. Attendance is an essential part of learning and failure to attend without approval may affect your progression. If you miss classes due to medical issues, inform the Department promptly and provide formal documentation (typically from a public hospital). Exceeding the maximum allowed absences may result in loss of module credits and possible exclusion from study."
  },

  code_of_conduct: {
    title: "Student Code of Conduct",
    content: "To create a respectful learning environment, you are expected to: Attend all scheduled sessions, be punctual and avoid disrupting classes, come prepared and engage actively, respect diversity—discrimination of any kind is not tolerated, keep mobile phones off and ask permission to record sessions, avoid eating or drinking in classrooms."
  },

  extenuating_circumstances: {
    title: "Extenuating and Exceptional Circumstances",
    content: "If serious personal situations affect your performance, submit a claim for Exceptional Circumstances as early as possible—preferably before the assessment. Examples include: serious illness, hospitalization, or mental health issues, close family bereavement, victim of a crime, major transport disruptions, required interviews or legal proceedings. Provide supporting evidence (e.g., medical documents from a public hospital). If approved, you may be allowed to retake assessments or receive an extension. Grades are never changed without reassessment."
  },

  turnitin_policy: {
    title: "Turnitin Submission Policy",
    content: "All written work must be submitted through Turnitin, which checks for plagiarism and collusion. You'll receive instructions on how to use it. Work not submitted through Turnitin will not be marked. Misconduct cases are taken seriously and can impact references for jobs or further studies. If unsure about how to reference properly, consult your tutor."
  },

  disciplinary_issues: {
    title: "Student Disciplinary Issues and Actions",
    content: "Students may face disciplinary action by the Department or College if they commit misconduct. Examples include: physical or sexual misconduct, abusive, threatening, or disruptive behavior, damaging or stealing property, creating health or safety risks, obstructing College operations, criminal convictions, academic misconduct (e.g., plagiarism, cheating)."
  },

  withdrawal_policy: {
    title: "Student Withdrawal from Studies",
    content: "If you decide to permanently leave your studies, this is called withdrawal. Speak to your Head of Department before making a final decision. Discussions are confidential."
  },

  campus_resources: {
    title: "Campus Buildings and Facilities",
    content: "Main Buildings: LEONTOS SOFOU (3 Leontos Sofou Str.) includes Student Services, IT Support, Library, Classrooms (L1–L5), Cafe, Labs (Ethra & Thalis), Auditorium, Registrar, Department Offices. STRATEGAKIS (24 Prox. Koromila Str.) includes Psychology Dept., Neuroscience Center, Executive Rooms, Classrooms (A1–A3), Student Services, Financial Office, Counselling."
  },

  library_ilc: {
    title: "Information & Learning Commons (ILC)",
    content: "A multifunctional space that includes: Entire Library collection, Library Services Desk, Study rooms (silent, group, PC-equipped), Collaborative areas and social space."
  },

  student_office: {
    title: "Student Office Support Services",
    content: "Supports cultural, social, academic, and personal development. Offers help with: Visas and residence permits, Housing, Greek classes, Sports & clubs, Union support, Discounts, Personal advising."
  },

  career_office: {
    title: "Career and Employability Office",
    content: "Helps students plan and pursue careers. Services include: CV, cover letter, and interview help, Career fairs and internships, Career goal setting, Job application support."
  },

  student_union: {
    title: "CITY Student Union (CSU)",
    content: "Run by students, for students. CSU: Represents student interests, Organizes activities, Acts as the official student voice, Holds elections annually for representatives."
  },

  academic_representatives: {
    title: "Academic Representatives",
    content: "Student volunteers who: Represent classmates to staff and CSU, Attend committee and senate meetings, Must apply in the 4th week of the autumn semester, Must demonstrate good conduct, Help improve the academic experience."
  },

  student_evaluation: {
    title: "Student Evaluation and Feedback System",
    content: "Your feedback matters. Anonymous Student Evaluation Questionnaires (SEQs) are given each semester to improve: Modules and teaching, Coursework and feedback, College services (IT, Library, etc.). Feedback is reviewed by staff-student forums and helps shape future curriculum and services."
  },

  enrollment: {
    title: "Student Enrollment Requirements",
    content: "No student will be permitted to attend lectures, classes or examinations, or to receive materials issued by the College until enrolled. An enrolled student will be issued with a student card. On enrolment, a student must sign up to the Terms and Conditions and agree to the Ordinances and Regulations of the University and the College. Students must enroll at the start of their program and annually thereafter. Failure may result in withdrawal. Students must keep the College informed of their current address. Students who fail to enroll on time may be deemed withdrawn."
  },

  fees: {
    title: "Tuition Fees and Payment",
    content: "Fees are determined by the College Administration Board and published on the College's website. The registration fee is a one-off payment and non-refundable unless the application is rejected. Tuition fees exclude Greek taxes and bank charges. Fees are due at the beginning of each semester; payment schedules may differ by program. Students who owe fees from previous sessions may not register again. Late payment may result in loss of student status. Failure to pay within four weeks may result in de-registration unless extended by the Financial Officer. Students with unpaid fees are not eligible for scholarships or prizes. Examination results may be withheld for unpaid tuition fees."
  },

  attendance: {
    title: "Attendance Requirements",
    content: "Attendance of lectures and classes is compulsory, and the number of absences should not exceed 25% of the total contact hours. This includes absences for medical reasons. A candidate who fails to comply may be denied credits for the relevant module. Allowed absences: 20 contact hours = 5 absences, 24 hours = 6 absences, 28 hours = 7 absences, 30 hours = 8 absences, 36 hours = 9 absences. For PGT programs: 8-9 modules = up to 2 module absences allowed, 14 modules = up to 3 module absences allowed."
  },

  study_periods: {
    title: "Period of Study and Study Duration",
    content: "BA/BSc degrees: Normal period of study is 3 years full-time (no part-time option available), with a maximum period of 4 years full-time. MA/MSc degrees: Normal period is 1 year full-time or 2 years part-time, maximum 2 years full-time or 3 years part-time. MBA: No full-time option available, normal period 27 months part-time, maximum 4 years part-time. MA with Practicum: Normal period 2 years full-time or 3 years part-time, maximum 3 years full-time or 4 years part-time. These limits do not include any allowance for leave of absence or extension of submission."
  },

  leave_of_absence: {
    title: "Leave of Absence",
    content: "A leave of absence allows a student to take a break in studies for documented medical or personal reasons. Leave is normally granted for up to one year at a time and a maximum of two years in total. It must be applied for in advance. Retrospective requests will not normally be approved. Leave will not be granted within the student's first month of enrolment. Any student may apply, but approval is not guaranteed and may be subject to the academic department. Visa or permit rules may further restrict this option. During leave, students are expected to pause their studies."
  },

  calculator_policy: {
    title: "Use of Calculators in Examinations",
    content: "A candidate wishing to use an electronic calculator in an examination must request approval no later than week 10 of the relevant Semester. Approval is granted individually, and each calculator must be presented for attachment of a distinctive marker. Steps: 1) Consult approved/prohibited lists in Departmental Offices, 2) If approved, take to office for marking, 3) If prohibited, do not use, 4) If unlisted, take to office by mid-December. Calculators without external programming and with numeric functions only are generally allowed. Prohibited: those with alphabetic displays of stored data, those capable of external programmability. Using prohibited calculator is treated as unfair means."
  },

  examination_procedures: {
    title: "Examination Day Procedures", 
    content: "Students arriving more than 30 minutes late will not be admitted. Students may not leave until 40 minutes after exam starts and must not leave in final 10 minutes. Bring only essential items in transparent bag. Large bags must be left outside hall. Mobile phones and text-storing devices not allowed - if brought, must be handed to Invigilator. Students missing exam without valid reason will not get special papers and considered failed. Must bring student card with Registration Number to every examination. Check notice board for assigned seating."
  },

  unfair_means: {
    title: "Use of Unfair Means in Assessment",
    content: "All academic work must be original. Prohibited acts include: Plagiarism (using others' ideas without acknowledgment), Collusion (working together on individual assignments), Submitting bought or commissioned work, Double submission (resubmitting previous work), Fabrication (false data), Use of AI-generated work. Students must sign plagiarism declaration on each assessment. City College Thessaloniki, University of York uses plagiarism detection system - all assignments must be uploaded. Categories: Type A (minor misuse), Type B (extensive deliberate misuse), Type C (unfair means during closed assessments)."
  },

  library_regulations: {
    title: "Library Regulations and Rules",
    content: "Library access requires valid student card to borrow materials. Materials must be returned/renewed by due date - late returns may incur fines. Reference materials must not be removed unless explicitly permitted. Noise must be kept to minimum, mobile phones on silent, calls made outside library. FOOD AND DRINKS: Food and drinks are generally not permitted in the library, except water in sealable bottles. Library computers for academic purposes only, not for gaming or entertainment. Students must not remove materials without properly checking them out. Personal belongings should not be left unattended for security reasons."
  },

  misconduct: {
    title: "Acts of Misconduct",
    content: "Misconduct is improper interference with College functioning or activities. Examples include: disruption of academic/administrative activities, obstruction of functions, violent/threatening behavior, fraud/deception, actions causing injury/safety risks, harassment/bullying, property damage, misuse of premises, behavior bringing College into disrepute, failure to follow staff instructions, theft of personal data. Report to Department Head with clear description. Investigation may lead to disciplinary hearing. Penalties include warning, suspension, or expulsion."
  },

  scholarships: {
    title: "Scholarships, Awards and Prizes",
    content: "Student must be in good academic standing with no outstanding disciplinary issues. May be subject to income or nationality criteria. Awards normally based on assessment results, may be withdrawn if performance deteriorates. Must fulfill all financial obligations - no award for students in financial default. False declaration may result in immediate withdrawal and disciplinary measures. Winners may be announced publicly."
  },

  re_admission: {
    title: "Re-admission to City College Thessaloniki, University of York",
    content: "Students may only be readmitted with approval from the Head of Department and Vice President of Learning & Teaching if they: Were previously excluded from City College Thessaloniki, University of York, Failed or withdrew from a prior program and seek admission to the same or related subject, Studied first year twice before at City College Thessaloniki, University of York, Postgraduates who failed to complete their earlier program."
  },

  ethics_approval: {
    title: "Ethics Approval for Research",
    content: "Students undertaking research involving human participants, personal data, or tissue must get ethics approval from the Departmental Ethics Committee before starting. Failure to do so may result in disciplinary action."
  },

  transcripts_diplomas: {
    title: "Transcripts and Diploma Supplements",
    content: "The University will provide a Transcript and/or Diploma Supplement for students who complete a program of study or require evidence of credits obtained. These documents include module levels, credit values, and grades. Students may request transcripts through the College Academic Registrar."
  },

  computing_facilities: {
    title: "Code of Practice for Computing Facilities",
    content: "Students are granted access to computing facilities to support academic studies. Access is individual and must not be shared. Students must use assigned credentials and not disclose them to others. Activities that threaten system integrity are prohibited. Unauthorized access attempts are forbidden. Use must be legal and ethical - no offensive, obscene, or discriminatory material. Software must not be copied or redistributed without permission. Personal use is allowed if it doesn't interfere with College operations."
  },

  complaints_procedure: {
    title: "Non-Academic Complaints Procedure",
    content: "Students have the right to complain if College services don't meet standards or if staff/students behave inappropriately. First try informal resolution with the relevant person or Head of Department. If unresolved, submit formal written complaint to Vice President for Academic Affairs within one month of the event. Include clear explanation, evidence, and desired outcome. VP will investigate and respond in writing. If dissatisfied, may appeal to Principal whose decision is final. Malicious or vexatious complaints may result in disciplinary action."
  },

  tuition_fee_refund: {
    title: "Tuition Fee Refund Policy",
    content: "Tuition fees may be refunded when students withdraw from their course or take leave of absence. Grounds for refunds include: voluntary or involuntary withdrawal, leave of absence (except when ending within same academic year), transfers/downgrades from Master's to Diploma/Certificate (unless due to academic failure), early thesis submission for PGR students (pro-rata monthly basis). Refund calculation based on timing: 50% refund if withdrawal/leave occurs between Intro Week and Week 3, no refund if between Week 6-12. Registration fee deposits are strictly non-refundable. Refunds returned to original payment method. Contact financial@york.citycollege.eu for clarification. Tuition fees NOT refunded for: individual units/modules dropped, leave within same academic year, PGR leave less than 6 months, transfers due to academic failure where services already provided."
  },

  student_compensation: {
    title: "Student Compensation and Refund Policy", 
    content: "This policy covers financial refunds, reductions, or re-delivery of services for material contract breaches or upheld complaints. Compensation applies when City College Thessaloniki, University of York cannot maintain continuity of study or academic disruption occurs. PROGRAM TERMINATION: If program discontinued/terminated mid-way while students enrolled, students may claim compensation for forced withdrawal, transfer to another program at City College Thessaloniki, University of York or another institution, claim financial compensation for additional costs like tuition differences, travel, accommodation. Students may claim compensation for: program cancellation/termination, forced withdrawal, additional costs from transfers, tuition fees, living/maintenance costs, lost time, accommodation/travel expenses. Eligibility: all enrolled students (self-funded or sponsored), refunds only to original payer, normally excludes graduates. Claims process: complete Complaints Procedure first, submit written claim within 14 days response time. For PGR students: if supervisor leaves without replacement, may transfer or claim compensation. Group claims available for large-scale issues. EXTERNAL REVIEW: If dissatisfied with compensation decision, external review available through Office of Independent Adjudicator (OIA). Contact financial@york.citycollege.eu for specific cases."
  },

  anti_harassment_policy: {
    title: "Policy for Discrimination, Bullying, Cyberbullying, Sexual Harassment and Abusive Behavior",
    content: "City College Thessaloniki, University of York is committed to inclusion, respect, and safety for all staff and students. This policy defines and addresses discrimination, bullying, cyberbullying, sexual harassment, and abusive behavior. Definitions: Sexual harassment (unwelcome sexual remarks/advances), Bullying (persistent offensive behavior undermining confidence), Cyberbullying (online harassment through social networks/messaging), Discrimination (unfavorable treatment based on age, disability, gender, race, religion, sex, sexual orientation, etc.). HOW TO REPORT HARASSMENT: 1) Report incidents immediately to your Academic Director and Head of Department, 2) Contact the Gender Equality Officer directly for support and guidance, 3) Submit written reports to Student Support Office, 4) For urgent situations, contact campus security or administration. For student perpetrators: handled under City College Thessaloniki, University of York Regulations. For staff perpetrators: investigated by Sexual Misconduct Committee chaired by Gender Equality Officer. SUPPORT AVAILABLE: Gender Equality Officer provides confidential support to alleged victims through City College Thessaloniki, University of York Community Counselling Center as appropriate. Counseling services, academic support, and safety measures available. All reports handled with strict GDPR compliance and confidentiality. CONTACTS: Student Support Office (24 Proxenou Koromila St., Thessaloniki), Gender Equality Officer (available through Student Support Office), Campus Administration (main office). Community members encouraged to report incidents promptly to maintain inclusive environment where everyone feels accepted and valued. No retaliation policy strictly enforced."
  },

  terms_and_conditions: {
    title: "Terms and Conditions Relating to Your Offer",
    content: "These terms form part of your formal admission offer and explain your contractual relationship with City College Thessaloniki, University of York. Key provisions: ACCURACY - Information submitted must be accurate; false/misleading information may result in cancellation of admission. COURSE CHANGES - College may make necessary changes to improve education (content, scheduling, delivery format, assessment); substantial changes allow withdrawal with transfer support and possible refunds. FEES - All tuition fees and costs must be paid on time; failure may result in suspension/exclusion; qualifications not awarded until debts cleared; refunds available in limited cases (visa rejection, refund policy). CRIMINAL CONVICTIONS - Must disclose unspent serious criminal convictions; failure to disclose may lead to disciplinary action or termination. DISABILITY - College supports inclusive environment and implements reasonable adjustments. IMMIGRATION - Non-EU students must show valid visa status; visa revocation may cancel enrollment. LIABILITY - College not responsible for damages beyond control or indirect losses; limited to tuition fees paid. COMPLAINTS - May submit complaints under official procedure; external review available through Office of Independent Adjudicator. Contract governed by Greek law and resolved in Greek courts."
  },

  student_privacy_notice: {
    title: "Student Privacy Notice (Data Protection)",
    content: "City College Thessaloniki, University of York collects and processes student data under GDPR regulations to manage academic progress, support services, and meet legal obligations. DATA COLLECTED - Personal details, education background, financial data, immigration status, academic performance, health information, career support details, visa documentation. DATA USE - Restricted to legitimate educational, administrative, and legal purposes. SECURITY - Strict data protection and information security policies; not shared with third parties unless legally required. STUDENT RIGHTS - Access personal records through Academic Services, data portability, erasure (marketing data only, not academic records), restriction/objection in some cases, withdraw consent from promotional communications. TRANSFERS - Data may be transferred outside EU for international applications, embassies, sponsors, recruiters. RETENTION - Some data retained permanently to verify attendance/qualifications; other documents stored 6 years after course completion. COMPLAINTS - Contact Academic Services Department or Hellenic Data Protection Authority for data handling concerns."
  },

  radicalization_prevention: {
    title: "Policy on Prevention of Radicalization and Extremism",
    content: "City College Thessaloniki, University of York upholds freedom of speech while preventing radicalization and extremism. DEFINITIONS - Radicalization: process supporting terrorism and extremist ideologies. Extremism: active opposition to fundamental democratic values, rule of law, liberty, tolerance. VULNERABILITY FACTORS - Extreme literature possession, underachievement, peer rejection, family conflict, identity confusion, poverty, social exclusion, extremist influence, trauma, sudden behavioral changes. REPORTING PROCESS (Notice, Check, Share) - Notice concerning behavior, check with student/colleagues, share concerns with Student Support Office. If radicalization suspected: notify President and Principal, consult staff, involve police if necessary, offer support to student. STAFF CONCERNS - Same process applies; contact line manager or President/Principal for guidance. PROTECTION - Concerns can be raised anonymously; support offered even if individual declines to engage. If someone is becoming an extremist or showing signs of radicalization, follow Notice-Check-Share process immediately."
  },

  malpractice_policy: {
    title: "Policy for Malpractice, Impropriety or Wrongdoing (Whistleblowing)",
    content: "City College Thessaloniki, University of York enables staff, students, and committee members to raise concerns about malpractice without fear of reprisal. REPORTABLE CONCERNS - Criminal acts, legal breaches, miscarriages of justice, health/safety risks, environmental damage, fraud, maladministration, obstruction of academic freedom, regulation breaches, academic/professional malpractice, concealment of above. ACADEMIC FREEDOM - Right to question, test ideas, express unpopular views without losing privileges. REPORTING PROCESS - Make disclosure to President/Principal or Vice-President; if they're implicated, report to College Executive Board. CONFIDENTIALITY - Handled confidentially though identity may need sharing for investigation. INVESTIGATION - Designated person decides whether to investigate, appoints investigator, informs whistleblower of outcome. PROTECTION - No action against good faith disclosures; malicious claims may lead to disciplinary action; retaliation against whistleblowers may result in disciplinary proceedings. RECORDS - All disclosures documented and kept for 5 years."
  },

  academic_references: {
    title: "Guide to Providing Academic/Professional References",
    content: "City College Thessaloniki, University of York requires references for admission. REQUIREMENTS - Most Master's courses (MSc, MA) require two references; Executive MBA needs only one professional reference. Recent graduates should provide two academic references; if not possible, professional references accepted from employer (supervisor, head, senior staff), voluntary organization leader, or recognized society official. REFEREE GUIDELINES - References must be in English, commenting on applicant's academic/professional suitability for postgraduate study. Academic referees should include details of academic progress and English proficiency assessment if not native speaker. REQUIRED INFORMATION - Referee's full name and title, institution/business name and address, contact details, relationship to applicant. SUBMISSION - Send via email to admissions@york.citycollege.eu or sealed envelope by post. GDPR NOTICE - References may be disclosed to applicant under GDPR; stick to factual and academic/professional judgments. Contact Admissions Office if trouble securing suitable reference."
  },

  english_language_requirements: {
    title: "English Language Qualifications and Requirements",
    content: "City College Thessaloniki, University of York requires English proficiency for admission. TWO LEVELS ACCEPTED: MASTERY (CEFR C2) - Bachelor's minimum 169 overall/162 per component, Master's minimum 176 overall/162 per component. Accepted: Cambridge CPE, IELTS 8.5+, ECPE Michigan, Pearson Level 5, Trinity ISE IV, GCSE English Grade C/4, Duolingo (Bachelor's 100/90, Master's 110/90), Greek State Certificate C2. EFFECTIVE OPERATIONAL (CEFR C1) - Bachelor's minimum 169/162, Master's minimum 176/162. Accepted: Cambridge CAE, IELTS (Bachelor's 6.0+, Master's 6.5+), TOEFL iBT (Bachelor's 79+, Master's 87+), Pearson Level 4, Trinity ISE III, Greek State Certificate C1. Multiple testing organizations accepted including Cambridge, IELTS, TOEFL, Pearson, Trinity, City & Guilds, ESB, LanguageCert, Duolingo. Contact admissions@york.citycollege.eu for questions."
  },

  appeals_complaints_procedures: {
    title: "Appeals and Complaints Procedures for Applicants",
    content: "City College Thessaloniki, University of York provides fair, efficient appeals and complaints process for applicants. SCOPE - Covers academic selection, fee status assessment, admission terms. Does NOT cover tuition fee setting, funding decisions, accommodation allocation. APPEALS - Formal request to review admissions decision within 30 working days. Grounds: college didn't follow published procedures, not all application information considered. Cannot appeal academic judgment about suitability. COMPLAINTS - Formal dissatisfaction with admissions policies/procedures or staff actions. Usually doesn't change admissions decision. PROCESS - Phase 1: Informal feedback from Admissions Office. Phase 2: Formal appeal/complaint via form or written notice, acknowledged within 3 days, response within 15 days. Phase 3: Case Review if unsatisfied, request within 10 days, decision within 28 days by Principal or Case Review Panel. UNACCEPTABLE BEHAVIOR - College may suspend case for unreasonable, aggressive behavior or repeatedly raising resolved issues. Contact: admissions@york.citycollege.eu"
  },

  undergraduate_admission_requirements: {
    title: "Undergraduate (Bachelor's) Admission Requirements",
    content: "UNDERGRADUATE STUDIES (3-year Bachelor's programmes) ADMISSION REQUIREMENTS: SECONDARY EDUCATION DIPLOMAS - High School Leaving Certificate with good performance and High School Diploma, OR International Baccalaureate (IB) Diploma or at least six IB Subject Certificates (including at least three at higher level) with minimum total of 30 points, OR A Levels obtained locally. ENGLISH REQUIREMENTS - Very good knowledge of English certified by: IELTS Academic overall 6.0+ with at least 5.5 in each component, Pearson PTE Academic overall 55+ with no less than 51 in each component, Cambridge CAE overall 169+ with no less than 162 in each component, Cambridge CPE overall 169+ with no less than 162 in each component, TOEFL iBT overall 79+ with minimum 17 Listening/18 Reading/20 Speaking/17 Writing, MSU-CELP CEFR C2, GCSE English minimum Grade C/4, iGCSE English minimum Grade C, Trinity ISE Level 3 with Pass in all components, Duolingo overall 100 with minimum 90 in all components, ECPE, MELAB overall 91+ with minimum 81 writing/listening/GCVR and minimum 3- speaking (accepted until July 2020), Michigan English Test (MET) overall 230+ with minimum 53 in each component. Candidates who completed high school through English medium are exempt (proof required). APPLICATION REQUIREMENTS - Application form (www.york.citycollege.eu), Identity-card size coloured photograph, Certified copy of High-School Leaving Certificate and transcripts from last three years, Certified photocopy of English language qualification, Copy of passport/ID with Latin/English alphabet, Registration fee (one-time, refundable if application rejected or visa denied). Submit to: admissions@york.citycollege.eu or CITY College Admissions Office, 24 Proxenou Koromila St., 54622 Thessaloniki, Greece."
  },

  postgraduate_admission_requirements: {
    title: "Postgraduate (Master's) Admission Requirements", 
    content: "POSTGRADUATE STUDIES (Master's programmes) ADMISSION REQUIREMENTS: BACHELOR'S DEGREE - Bachelor's degree with good performance in any field required for all Master's programmes. SPECIFIC PROGRAMME REQUIREMENTS - MSc Web and Mobile Development / MSc Artificial Intelligence & Data Science: require undergraduate degree in Computer Science, Computer Engineering, or related ICT discipline (candidates with other disciplines considered based on extensive professional practice). MA Translation and Interpreting: candidates must be fluent in Greek language. ENGLISH REQUIREMENTS - Advanced knowledge of English certified by: IELTS Academic overall 6.5+ with at least 5.5 in each component, Pearson PTE Academic overall 61+ with no less than 51 in each component, Cambridge CAE overall 176+ with no less than 162 in each component, Cambridge CPE overall 176+ with no less than 162 in each component, TOEFL iBT overall 87+ with minimum 17 Listening/18 Reading/20 Speaking/17 Writing, MSU-CELP CEFR C2, GCSE English minimum Grade C/4, iGCSE English minimum Grade C, Trinity ISE Level 3 with Pass in all components, Duolingo overall 110 with minimum 90 in all components, ECPE, MELAB overall 91+ with minimum 81 writing/listening/GCVR and minimum 3- speaking, Michigan English Test overall 230+ with minimum 53 in each component. Other qualifications may be considered - contact admissions@york.citycollege.eu. Candidates who completed Bachelor's or higher secondary education through English medium normally exempt (proof required). APPLICATION REQUIREMENTS - Application form, Identity-card size coloured photograph, Certified photocopy of University degree(s) and all transcripts, Certified photocopy of English language qualification, TWO Reference Letters (from academic supervisors, employers, or community leaders - at least one from university professor if possible), Copy of passport/ID, Registration fee (refundable if rejected or visa denied). Submit to: admissions@york.citycollege.eu"
  },

  executive_mba_admission_requirements: {
    title: "Executive MBA Admission Requirements",
    content: "EXECUTIVE MBA ADMISSION REQUIREMENTS: Admission decisions consider three primary areas: 1) PROFESSIONAL EXPERIENCE (length, breadth, depth of professional/managerial experience; potential for career development), 2) ACADEMIC QUALIFICATIONS (Bachelor's degree from accredited institution or previous postgraduate studies with satisfactory achievement), 3) ADDITIONAL CRITERIA (contribution potential to learning experience; motivation; time/energy commitment ability; community service; professional activities; employer support). Group admissions from same company/industry considered based on class composition and individual criteria. Class diversity in job function and industry is objective. STANDARD REQUIREMENTS - Undergraduate degree from accredited institution (doesn't have to be business degree), Minimum 3-5 years professional work experience, Verified English Language Competence. NOTE: Small number of applicants may be accepted without undergraduate degree if they have substantial managerial experience and meet other requirements. ENGLISH REQUIREMENTS - Fluent English command proven by: IELTS Academic overall 6.5+ with at least 5.5 in each component, Pearson PTE Academic overall 61+ with no less than 51 in each component, Cambridge CAE overall 176+ with no less than 162 in each component, Cambridge CPE overall 176+ with no less than 162 in each component, TOEFL iBT overall 87+ with minimum 17 Listening/18 Reading/20 Speaking/17 Writing, MSU-CELP CEFR C2, GCSE English minimum Grade C/4, iGCSE English minimum Grade C, Trinity ISE Level 3 with Pass in all components, Duolingo overall 110 with minimum 90 in all components, ECPE, MELAB overall 91+, Michigan English Test overall 230+. Other qualifications may be considered. Candidates who completed Bachelor's/higher secondary through English medium normally exempt. Executive MBA applicants without formal English qualification but meeting other requirements may take Internal English Language Assessment Test. APPLICATION REQUIREMENTS - Application form, Identity-card photograph, Certified photocopy of University degree(s) and transcripts, Certified photocopy of English language qualification (or Internal Assessment), ONE Reference Letter from employment supervisor, Current Resume/CV (no standard format), Copy of passport/ID, Registration fee (refundable if rejected/visa denied). Submit to: admissions@york.citycollege.eu"
  }
};

// RAG: Retrieval function - finds relevant policies
function retrieveRelevantPolicies(query) {
  const lowerQuery = query.toLowerCase();
  const relevantPolicies = [];
  

  
  // Enhanced natural language processing - handle common conversational patterns
  const naturalLanguageEnhancements = {
    // Common question starters that might indicate specific topics
    isAskingAboutCost: lowerQuery.includes('how much') || lowerQuery.includes('what does it cost') || lowerQuery.includes('price') || lowerQuery.includes('expensive'),
    isAskingAboutTime: lowerQuery.includes('when') || lowerQuery.includes('what time') || lowerQuery.includes('how long') || lowerQuery.includes('duration'),
    isAskingAboutPermission: lowerQuery.includes('can i') || lowerQuery.includes('am i allowed') || lowerQuery.includes('is it ok') || lowerQuery.includes('permitted'),
    isAskingAboutProcess: lowerQuery.includes('how do i') || lowerQuery.includes('how to') || lowerQuery.includes('what do i need') || lowerQuery.includes('steps'),
    isAskingAboutRequirements: lowerQuery.includes('what do i need') || lowerQuery.includes('requirements') || lowerQuery.includes('need to have'),
    isAskingAboutConsequences: lowerQuery.includes('what happens if') || lowerQuery.includes('penalty') || lowerQuery.includes('consequence'),
    isAskingAboutHelp: lowerQuery.includes('where can i get help') || lowerQuery.includes('who should i contact') || lowerQuery.includes('need help'),
    isAskingAboutLocation: lowerQuery.includes('where') || lowerQuery.includes('location') || lowerQuery.includes('find'),
    isAskingAboutDeadlines: lowerQuery.includes('deadline') || lowerQuery.includes('due date') || lowerQuery.includes('when is it due'),
    isAskingAboutExceptions: lowerQuery.includes('emergency') || lowerQuery.includes('special circumstances') || lowerQuery.includes('exception')
  };

  for (const [key, policy] of Object.entries(universityPolicies)) {
    let relevanceScore = 0;
    const lowerContent = policy.content.toLowerCase();
    const lowerTitle = policy.title.toLowerCase();
    
    // Score based on title match
    if (lowerTitle.includes(lowerQuery.split(' ')[0])) relevanceScore += 10;
    
    // Score based on content keywords
    const keywords = lowerQuery.split(' ');
    keywords.forEach(keyword => {
      if (keyword.length > 2 && lowerContent.includes(keyword)) {
        relevanceScore += 5;
      }
    });
    
    // ENHANCED NATURAL LANGUAGE PATTERNS - boost scoring for conversational questions
    
    // Fee-related conversational patterns
    if (naturalLanguageEnhancements.isAskingAboutCost && (key === 'fees' || lowerContent.includes('fee') || lowerContent.includes('cost') || lowerContent.includes('payment'))) {
      relevanceScore += 20;
    }
    
    // Time-related questions for semesters, deadlines, durations
    if (naturalLanguageEnhancements.isAskingAboutTime && (key === 'semesters' || key === 'study_periods' || key === 'examination_procedures' || key === 'coursework_submission' || lowerContent.includes('week') || lowerContent.includes('semester') || lowerContent.includes('deadline'))) {
      relevanceScore += 20;
    }
    
    // Permission-related questions for rules and policies
    if (naturalLanguageEnhancements.isAskingAboutPermission && (key === 'library_regulations' || key === 'calculator_policy' || key === 'code_of_conduct' || key === 'attendance' || lowerContent.includes('allow') || lowerContent.includes('permit') || lowerContent.includes('rule'))) {
      relevanceScore += 20;
    }
    
    // Process questions for applications, submissions, procedures
    if (naturalLanguageEnhancements.isAskingAboutProcess && (key === 'coursework_submission' || key === 'examination_procedures' || key === 'leave_of_absence' || key === 'complaints_procedure' || key === 'appeals_complaints_procedures' || lowerContent.includes('process') || lowerContent.includes('procedure') || lowerContent.includes('submit'))) {
      relevanceScore += 20;
    }
    
    // Requirements questions for admissions, enrollment, qualifications
    if (naturalLanguageEnhancements.isAskingAboutRequirements && (key === 'undergraduate_admission_requirements' || key === 'postgraduate_admission_requirements' || key === 'executive_mba_admission_requirements' || key === 'english_language_requirements' || key === 'enrollment' || key === 'attendance' || lowerContent.includes('requirement') || lowerContent.includes('need') || lowerContent.includes('qualification'))) {
      relevanceScore += 20;
    }
    
    // Consequences questions for late work, misconduct, failure
    if (naturalLanguageEnhancements.isAskingAboutConsequences && (key === 'coursework_submission' || key === 'unfair_means' || key === 'disciplinary_issues' || key === 'attendance' || key === 'compensation_rules' || key === 'reassessment_rules' || lowerContent.includes('penalty') || lowerContent.includes('consequence') || lowerContent.includes('late'))) {
      relevanceScore += 20;
    }
    
    // Help questions for support services and contacts
    if (naturalLanguageEnhancements.isAskingAboutHelp && (key === 'student_office' || key === 'career_office' || key === 'campus_resources' || key === 'complaints_procedure' || lowerContent.includes('help') || lowerContent.includes('support') || lowerContent.includes('contact') || lowerContent.includes('office'))) {
      relevanceScore += 20;
    }
    
    // Location questions for buildings and facilities
    if (naturalLanguageEnhancements.isAskingAboutLocation && (key === 'campus_resources' || key === 'library_ilc' || key === 'student_office' || key === 'career_office' || lowerContent.includes('building') || lowerContent.includes('room') || lowerContent.includes('location') || lowerContent.includes('where'))) {
      relevanceScore += 20;
    }
    
    // Exception questions for extenuating circumstances
    if (naturalLanguageEnhancements.isAskingAboutExceptions && (key === 'extenuating_circumstances' || key === 'leave_of_absence' || lowerContent.includes('emergency') || lowerContent.includes('exceptional') || lowerContent.includes('circumstance'))) {
      relevanceScore += 20;
    }
    
    // ENHANCED SPECIFIC HIGH-VALUE MATCHES WITH SYNONYMS
    
        // FEES - Enhanced with more synonyms and natural languagediscrimination
    if ((lowerQuery.includes('fee') || lowerQuery.includes('fees') || lowerQuery.includes('tuition') || lowerQuery.includes('cost') || lowerQuery.includes('costs') || lowerQuery.includes('payment') || lowerQuery.includes('payments') || lowerQuery.includes('money') || lowerQuery.includes('price') || lowerQuery.includes('pricing') || lowerQuery.includes('charge') || lowerQuery.includes('charges') || lowerQuery.includes('expensive') || lowerQuery.includes('cheap') || lowerQuery.includes('afford') || lowerQuery.includes('financial') || lowerQuery.includes('billing') || lowerQuery.includes('invoice') || lowerQuery.includes('owe') || lowerQuery.includes('debt') || lowerQuery.includes('pay') || lowerQuery.includes('paid') || lowerQuery.includes('unpaid') || (lowerQuery.includes('how') && lowerQuery.includes('much')) || (lowerQuery.includes('what') && (lowerQuery.includes('cost') || lowerQuery.includes('price'))) || lowerQuery.includes('registration') && lowerQuery.includes('fee') || lowerQuery.includes('semester') && (lowerQuery.includes('fee') || lowerQuery.includes('cost')) || lowerQuery.includes('annual') && (lowerQuery.includes('fee') || lowerQuery.includes('cost')) || lowerQuery.includes('yearly') && (lowerQuery.includes('fee') || lowerQuery.includes('cost')) || (lowerQuery.includes('can') && lowerQuery.includes('pay')) || (lowerQuery.includes('need') && lowerQuery.includes('pay')) || (lowerQuery.includes('have') && lowerQuery.includes('pay')) || lowerQuery.includes('installment') || lowerQuery.includes('installments') || lowerQuery.includes('schedule') && lowerQuery.includes('payment')) && key === 'fees') relevanceScore += 15;
    
    // SEMESTERS - Enhanced with natural language and time-related queries
    if ((lowerQuery.includes('semester') || lowerQuery.includes('semesters') || lowerQuery.includes('term') || lowerQuery.includes('terms') || lowerQuery.includes('academic') && lowerQuery.includes('year') || lowerQuery.includes('autumn') || lowerQuery.includes('fall') || lowerQuery.includes('spring') || lowerQuery.includes('october') || lowerQuery.includes('february') || lowerQuery.includes('march') || lowerQuery.includes('june') || (lowerQuery.includes('when') && (lowerQuery.includes('start') || lowerQuery.includes('begin') || lowerQuery.includes('commence'))) || (lowerQuery.includes('what') && lowerQuery.includes('time') && (lowerQuery.includes('start') || lowerQuery.includes('begin'))) || lowerQuery.includes('calendar') || lowerQuery.includes('schedule') && (lowerQuery.includes('academic') || lowerQuery.includes('year') || lowerQuery.includes('semester')) || lowerQuery.includes('15') && lowerQuery.includes('weeks') || lowerQuery.includes('12') && lowerQuery.includes('weeks') || lowerQuery.includes('3') && lowerQuery.includes('weeks') || lowerQuery.includes('break') && lowerQuery.includes('semester') || lowerQuery.includes('holiday') || lowerQuery.includes('vacation') || (lowerQuery.includes('how') && lowerQuery.includes('long') && (lowerQuery.includes('semester') || lowerQuery.includes('term'))) || (lowerQuery.includes('how') && lowerQuery.includes('many') && lowerQuery.includes('weeks')) || lowerQuery.includes('duration') && (lowerQuery.includes('semester') || lowerQuery.includes('term'))) && key === 'semesters') relevanceScore += 15;
    
    // ATTENDANCE - Enhanced with absence, missing class, and related queries
    if ((lowerQuery.includes('attendance') || lowerQuery.includes('attend') || lowerQuery.includes('attending') || lowerQuery.includes('absence') || lowerQuery.includes('absences') || lowerQuery.includes('absent') || lowerQuery.includes('miss') || lowerQuery.includes('missing') || lowerQuery.includes('missed') || lowerQuery.includes('skip') || lowerQuery.includes('skipping') || lowerQuery.includes('skipped') || lowerQuery.includes('class') && (lowerQuery.includes('miss') || lowerQuery.includes('absent') || lowerQuery.includes('skip')) || lowerQuery.includes('lecture') && (lowerQuery.includes('miss') || lowerQuery.includes('absent') || lowerQuery.includes('skip')) || lowerQuery.includes('compulsory') || lowerQuery.includes('mandatory') || lowerQuery.includes('required') && (lowerQuery.includes('class') || lowerQuery.includes('lecture')) || lowerQuery.includes('25%') || lowerQuery.includes('contact') && lowerQuery.includes('hours') || (lowerQuery.includes('how') && lowerQuery.includes('many') && (lowerQuery.includes('miss') || lowerQuery.includes('absent') || lowerQuery.includes('skip'))) || (lowerQuery.includes('can') && lowerQuery.includes('miss')) || (lowerQuery.includes('allowed') && (lowerQuery.includes('miss') || lowerQuery.includes('absent'))) || lowerQuery.includes('sick') && (lowerQuery.includes('class') || lowerQuery.includes('lecture')) || lowerQuery.includes('illness') && (lowerQuery.includes('class') || lowerQuery.includes('lecture')) || lowerQuery.includes('medical') && (lowerQuery.includes('absence') || lowerQuery.includes('miss')) || lowerQuery.includes('excuse') && (lowerQuery.includes('absence') || lowerQuery.includes('miss')) || lowerQuery.includes('penalty') && lowerQuery.includes('absence') || lowerQuery.includes('consequence') && lowerQuery.includes('absence')) && key === 'attendance') relevanceScore += 15;
    
    // LEAVE OF ABSENCE - Enhanced with break, gap year, and personal reasons
    if ((lowerQuery.includes('leave') || lowerQuery.includes('absence') && lowerQuery.includes('leave') || lowerQuery.includes('break') && (lowerQuery.includes('study') || lowerQuery.includes('studies') || lowerQuery.includes('academic')) || lowerQuery.includes('gap') && lowerQuery.includes('year') || lowerQuery.includes('suspend') || lowerQuery.includes('suspension') || lowerQuery.includes('pause') && (lowerQuery.includes('study') || lowerQuery.includes('studies')) || lowerQuery.includes('interrupt') && (lowerQuery.includes('study') || lowerQuery.includes('studies')) || lowerQuery.includes('defer') || lowerQuery.includes('deferral') || lowerQuery.includes('postpone') && (lowerQuery.includes('study') || lowerQuery.includes('studies')) || lowerQuery.includes('temporary') && (lowerQuery.includes('stop') || lowerQuery.includes('break')) || lowerQuery.includes('personal') && lowerQuery.includes('reasons') || lowerQuery.includes('medical') && lowerQuery.includes('reasons') || lowerQuery.includes('family') && lowerQuery.includes('emergency') || lowerQuery.includes('documented') && lowerQuery.includes('reasons') || (lowerQuery.includes('take') && lowerQuery.includes('time') && lowerQuery.includes('off')) || (lowerQuery.includes('step') && lowerQuery.includes('back')) || (lowerQuery.includes('need') && lowerQuery.includes('break')) || lowerQuery.includes('sabbatical') || lowerQuery.includes('hiatus') || (lowerQuery.includes('can') && lowerQuery.includes('pause')) || (lowerQuery.includes('how') && lowerQuery.includes('take') && lowerQuery.includes('break')) || lowerQuery.includes('retrospective') || lowerQuery.includes('advance') && lowerQuery.includes('request')) && key === 'leave_of_absence') relevanceScore += 15;
    
    // CALCULATOR - Enhanced with math, computation, and exam tool queries
    if ((lowerQuery.includes('calculator') || lowerQuery.includes('calculators') || lowerQuery.includes('math') && (lowerQuery.includes('tool') || lowerQuery.includes('device')) || lowerQuery.includes('computation') || lowerQuery.includes('computing') && lowerQuery.includes('device') || lowerQuery.includes('electronic') && (lowerQuery.includes('device') || lowerQuery.includes('tool')) || lowerQuery.includes('scientific') && lowerQuery.includes('calculator') || lowerQuery.includes('graphing') && lowerQuery.includes('calculator') || (lowerQuery.includes('can') && lowerQuery.includes('use') && (lowerQuery.includes('calculator') || lowerQuery.includes('math'))) || (lowerQuery.includes('allowed') && lowerQuery.includes('calculator')) || (lowerQuery.includes('permitted') && lowerQuery.includes('calculator')) || lowerQuery.includes('prohibited') && lowerQuery.includes('calculator') || lowerQuery.includes('approved') && lowerQuery.includes('calculator') || lowerQuery.includes('exam') && lowerQuery.includes('calculator') || lowerQuery.includes('test') && lowerQuery.includes('calculator') || lowerQuery.includes('assessment') && lowerQuery.includes('calculator') || lowerQuery.includes('week') && lowerQuery.includes('10') && lowerQuery.includes('approval') || lowerQuery.includes('marker') && lowerQuery.includes('calculator') || lowerQuery.includes('distinctive') && lowerQuery.includes('marker') || lowerQuery.includes('alphabetic') && lowerQuery.includes('display') || lowerQuery.includes('external') && lowerQuery.includes('programming') || lowerQuery.includes('numeric') && lowerQuery.includes('functions') || lowerQuery.includes('unfair') && lowerQuery.includes('means') && lowerQuery.includes('calculator')) && key === 'calculator_policy') relevanceScore += 15;
    
    // EXAM - Enhanced with test, assessment, and examination queries
    if ((lowerQuery.includes('exam') || lowerQuery.includes('exams') || lowerQuery.includes('examination') || lowerQuery.includes('examinations') || lowerQuery.includes('test') || lowerQuery.includes('tests') || lowerQuery.includes('testing') || lowerQuery.includes('assessment') || lowerQuery.includes('assessments') || lowerQuery.includes('final') && (lowerQuery.includes('exam') || lowerQuery.includes('test') || lowerQuery.includes('assessment')) || lowerQuery.includes('closed') && lowerQuery.includes('exam') || lowerQuery.includes('written') && lowerQuery.includes('exam') || lowerQuery.includes('midterm') || lowerQuery.includes('resit') || lowerQuery.includes('retake') || lowerQuery.includes('makeup') && lowerQuery.includes('exam') || lowerQuery.includes('late') && (lowerQuery.includes('exam') || lowerQuery.includes('test')) || lowerQuery.includes('30') && lowerQuery.includes('minutes') && lowerQuery.includes('late') || lowerQuery.includes('40') && lowerQuery.includes('minutes') && lowerQuery.includes('leave') || lowerQuery.includes('10') && lowerQuery.includes('minutes') && lowerQuery.includes('final') || lowerQuery.includes('transparent') && lowerQuery.includes('bag') || lowerQuery.includes('mobile') && lowerQuery.includes('phone') && lowerQuery.includes('exam') || lowerQuery.includes('student') && lowerQuery.includes('card') && lowerQuery.includes('exam') || lowerQuery.includes('registration') && lowerQuery.includes('number') || lowerQuery.includes('invigilator') || lowerQuery.includes('seating') && lowerQuery.includes('arrangement') || lowerQuery.includes('notice') && lowerQuery.includes('board') || lowerQuery.includes('miss') && lowerQuery.includes('exam') || lowerQuery.includes('absent') && lowerQuery.includes('exam') || lowerQuery.includes('special') && lowerQuery.includes('paper') || (lowerQuery.includes('when') && lowerQuery.includes('exam')) || (lowerQuery.includes('what') && lowerQuery.includes('time') && lowerQuery.includes('exam')) || (lowerQuery.includes('where') && lowerQuery.includes('exam')) || (lowerQuery.includes('how') && lowerQuery.includes('long') && lowerQuery.includes('exam')) || lowerQuery.includes('exam') && lowerQuery.includes('rules') || lowerQuery.includes('exam') && lowerQuery.includes('procedure') || lowerQuery.includes('exam') && lowerQuery.includes('policy')) && key === 'examination_procedures') relevanceScore += 15;
    
    // PLAGIARISM - Enhanced with cheating, academic dishonesty, and citation queries
    if ((lowerQuery.includes('plagiarism') || lowerQuery.includes('plagiarize') || lowerQuery.includes('plagiarized') || lowerQuery.includes('plagiarizing') || lowerQuery.includes('cheat') || lowerQuery.includes('cheating') || lowerQuery.includes('cheated') || lowerQuery.includes('academic') && lowerQuery.includes('dishonesty') || lowerQuery.includes('academic') && lowerQuery.includes('misconduct') || lowerQuery.includes('unfair') && lowerQuery.includes('means') || lowerQuery.includes('collusion') || lowerQuery.includes('collaborate') && lowerQuery.includes('individual') || lowerQuery.includes('copy') && (lowerQuery.includes('work') || lowerQuery.includes('assignment')) || lowerQuery.includes('copying') || lowerQuery.includes('stolen') && lowerQuery.includes('work') || lowerQuery.includes('bought') && lowerQuery.includes('work') || lowerQuery.includes('commissioned') && lowerQuery.includes('work') || lowerQuery.includes('double') && lowerQuery.includes('submission') || lowerQuery.includes('resubmit') || lowerQuery.includes('resubmission') || lowerQuery.includes('fabrication') || lowerQuery.includes('false') && lowerQuery.includes('data') || lowerQuery.includes('ai-generated') || lowerQuery.includes('artificial') && lowerQuery.includes('intelligence') || lowerQuery.includes('cite') || lowerQuery.includes('citation') || lowerQuery.includes('reference') && (lowerQuery.includes('properly') || lowerQuery.includes('correctly')) || lowerQuery.includes('acknowledge') && lowerQuery.includes('source') || lowerQuery.includes('turnitin') || lowerQuery.includes('plagiarism') && lowerQuery.includes('detection') || lowerQuery.includes('similarity') && lowerQuery.includes('report') || lowerQuery.includes('declaration') && lowerQuery.includes('plagiarism') || lowerQuery.includes('type') && lowerQuery.includes('a') && lowerQuery.includes('misuse') || lowerQuery.includes('type') && lowerQuery.includes('b') && lowerQuery.includes('misuse') || lowerQuery.includes('type') && lowerQuery.includes('c') && lowerQuery.includes('unfair') || lowerQuery.includes('minor') && lowerQuery.includes('misuse') || lowerQuery.includes('extensive') && lowerQuery.includes('misuse') || lowerQuery.includes('deliberate') && lowerQuery.includes('misuse') || (lowerQuery.includes('what') && lowerQuery.includes('plagiarism')) || (lowerQuery.includes('how') && lowerQuery.includes('avoid') && lowerQuery.includes('plagiarism')) || (lowerQuery.includes('caught') && lowerQuery.includes('plagiarism')) || (lowerQuery.includes('accused') && lowerQuery.includes('plagiarism'))) && key === 'unfair_means') relevanceScore += 15;
    // LIBRARY - Enhanced with regulations, rules, and food/drink queries
    if ((lowerQuery.includes('library') || lowerQuery.includes('libraries') || lowerQuery.includes('food') || lowerQuery.includes('drink') || lowerQuery.includes('drinks') || lowerQuery.includes('eating') || lowerQuery.includes('drinking') || lowerQuery.includes('snack') || lowerQuery.includes('snacks') || lowerQuery.includes('meal') || lowerQuery.includes('meals') || lowerQuery.includes('beverage') || lowerQuery.includes('beverages') || lowerQuery.includes('water') || lowerQuery.includes('coffee') || lowerQuery.includes('tea') || lowerQuery.includes('juice') || lowerQuery.includes('soda') || (lowerQuery.includes('can') && (lowerQuery.includes('eat') || lowerQuery.includes('drink'))) || (lowerQuery.includes('allowed') && (lowerQuery.includes('eat') || lowerQuery.includes('drink') || lowerQuery.includes('food'))) || (lowerQuery.includes('permitted') && (lowerQuery.includes('eat') || lowerQuery.includes('drink') || lowerQuery.includes('food'))) || lowerQuery.includes('noise') || lowerQuery.includes('quiet') || lowerQuery.includes('silent') || lowerQuery.includes('mobile') && lowerQuery.includes('phone') && lowerQuery.includes('library') || lowerQuery.includes('borrow') || lowerQuery.includes('borrowing') || lowerQuery.includes('return') || lowerQuery.includes('returning') || lowerQuery.includes('renew') || lowerQuery.includes('renewal') || lowerQuery.includes('due') && lowerQuery.includes('date') || lowerQuery.includes('late') && lowerQuery.includes('return') || lowerQuery.includes('fine') || lowerQuery.includes('fines') || lowerQuery.includes('reference') && lowerQuery.includes('material') || lowerQuery.includes('remove') && lowerQuery.includes('material') || lowerQuery.includes('check') && lowerQuery.includes('out') || lowerQuery.includes('student') && lowerQuery.includes('card') && lowerQuery.includes('library') || lowerQuery.includes('unattended') && lowerQuery.includes('belongings') || lowerQuery.includes('security') && lowerQuery.includes('library') || lowerQuery.includes('gaming') && lowerQuery.includes('library') || lowerQuery.includes('entertainment') && lowerQuery.includes('library') || lowerQuery.includes('academic') && lowerQuery.includes('purposes') && lowerQuery.includes('library') || lowerQuery.includes('sealable') && lowerQuery.includes('bottle') || lowerQuery.includes('library') && lowerQuery.includes('rules') || lowerQuery.includes('library') && lowerQuery.includes('regulation')) && key === 'library_regulations') relevanceScore += 15;
    
    // STUDY PERIODS - Enhanced with duration, program length, and time queries
    if ((lowerQuery.includes('study') && (lowerQuery.includes('period') || lowerQuery.includes('duration') || lowerQuery.includes('length') || lowerQuery.includes('time')) || lowerQuery.includes('program') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('degree') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('ba') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('bsc') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('ma') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('msc') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('mba') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('bachelor') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('master') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('undergraduate') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('postgraduate') && (lowerQuery.includes('length') || lowerQuery.includes('duration') || lowerQuery.includes('time')) || lowerQuery.includes('3') && lowerQuery.includes('years') || lowerQuery.includes('4') && lowerQuery.includes('years') || lowerQuery.includes('1') && lowerQuery.includes('year') || lowerQuery.includes('2') && lowerQuery.includes('years') || lowerQuery.includes('27') && lowerQuery.includes('months') || lowerQuery.includes('full-time') || lowerQuery.includes('part-time') || lowerQuery.includes('maximum') && lowerQuery.includes('period') || lowerQuery.includes('normal') && lowerQuery.includes('period') || (lowerQuery.includes('how') && lowerQuery.includes('long') && (lowerQuery.includes('degree') || lowerQuery.includes('program') || lowerQuery.includes('course') || lowerQuery.includes('study'))) || (lowerQuery.includes('what') && lowerQuery.includes('duration')) || lowerQuery.includes('practicum') || lowerQuery.includes('allowance') || lowerQuery.includes('extension') && lowerQuery.includes('submission')) && key === 'study_periods') relevanceScore += 15;
    
    // RE-ADMISSION - Enhanced with readmission, coming back, and return queries
    if ((lowerQuery.includes('readmit') || lowerQuery.includes('re-admit') || lowerQuery.includes('readmission') || lowerQuery.includes('re-admission') || lowerQuery.includes('readmitted') || lowerQuery.includes('re-admitted') || lowerQuery.includes('come') && lowerQuery.includes('back') || lowerQuery.includes('return') && (lowerQuery.includes('college') || lowerQuery.includes('university') || lowerQuery.includes('study') || lowerQuery.includes('studies')) || lowerQuery.includes('previously') && lowerQuery.includes('excluded') || lowerQuery.includes('failed') && lowerQuery.includes('program') || lowerQuery.includes('withdrew') && lowerQuery.includes('program') || lowerQuery.includes('withdrawn') && lowerQuery.includes('program') || lowerQuery.includes('dropped') && lowerQuery.includes('out') || lowerQuery.includes('left') && (lowerQuery.includes('college') || lowerQuery.includes('university')) || lowerQuery.includes('second') && lowerQuery.includes('chance') || lowerQuery.includes('another') && lowerQuery.includes('opportunity') || lowerQuery.includes('first') && lowerQuery.includes('year') && lowerQuery.includes('twice') || lowerQuery.includes('head') && lowerQuery.includes('department') && lowerQuery.includes('approval') || lowerQuery.includes('vice') && lowerQuery.includes('president') && lowerQuery.includes('approval') || lowerQuery.includes('same') && lowerQuery.includes('subject') || lowerQuery.includes('related') && lowerQuery.includes('subject') || lowerQuery.includes('postgraduate') && lowerQuery.includes('failed') || lowerQuery.includes('earlier') && lowerQuery.includes('program') || (lowerQuery.includes('can') && lowerQuery.includes('come') && lowerQuery.includes('back')) || (lowerQuery.includes('apply') && lowerQuery.includes('again')) || (lowerQuery.includes('reapply') || lowerQuery.includes('re-apply'))) && key === 're_admission') relevanceScore += 15;
    
    // ETHICS APPROVAL - Enhanced with research, ethics committee, and participant queries
    if ((lowerQuery.includes('ethics') || lowerQuery.includes('ethical') || lowerQuery.includes('research') || lowerQuery.includes('participants') || lowerQuery.includes('participant') || lowerQuery.includes('human') && lowerQuery.includes('subjects') || lowerQuery.includes('human') && lowerQuery.includes('participants') || lowerQuery.includes('approval') && lowerQuery.includes('research') || lowerQuery.includes('committee') && lowerQuery.includes('ethics') || lowerQuery.includes('ethics') && lowerQuery.includes('committee') || lowerQuery.includes('irb') || lowerQuery.includes('institutional') && lowerQuery.includes('review') || lowerQuery.includes('consent') && lowerQuery.includes('research') || lowerQuery.includes('informed') && lowerQuery.includes('consent') || lowerQuery.includes('study') && lowerQuery.includes('approval') || lowerQuery.includes('experiment') && lowerQuery.includes('approval') || lowerQuery.includes('survey') && lowerQuery.includes('approval') || lowerQuery.includes('interview') && lowerQuery.includes('approval') || lowerQuery.includes('data') && lowerQuery.includes('collection') && lowerQuery.includes('approval') || lowerQuery.includes('volunteer') && lowerQuery.includes('research') || lowerQuery.includes('research') && lowerQuery.includes('proposal') || lowerQuery.includes('methodology') && lowerQuery.includes('approval') || lowerQuery.includes('dissertation') && lowerQuery.includes('research') || lowerQuery.includes('thesis') && lowerQuery.includes('research') || (lowerQuery.includes('need') && lowerQuery.includes('ethics') && lowerQuery.includes('approval')) || (lowerQuery.includes('require') && lowerQuery.includes('ethics')) || (lowerQuery.includes('how') && lowerQuery.includes('get') && lowerQuery.includes('ethics')) || lowerQuery.includes('research') && lowerQuery.includes('ethics')) && key === 'ethics_approval') relevanceScore += 15;
    
    // TRANSCRIPTS & DIPLOMAS - Enhanced with certificates, documents, and official records
    if ((lowerQuery.includes('transcript') || lowerQuery.includes('transcripts') || lowerQuery.includes('diploma') || lowerQuery.includes('diplomas') || lowerQuery.includes('certificate') || lowerQuery.includes('certificates') || lowerQuery.includes('degree') && (lowerQuery.includes('copy') || lowerQuery.includes('document') || lowerQuery.includes('certificate')) || lowerQuery.includes('official') && (lowerQuery.includes('document') || lowerQuery.includes('record') || lowerQuery.includes('transcript') || lowerQuery.includes('certificate')) || lowerQuery.includes('academic') && (lowerQuery.includes('record') || lowerQuery.includes('transcript') || lowerQuery.includes('document')) || lowerQuery.includes('graduation') && lowerQuery.includes('certificate') || lowerQuery.includes('completion') && lowerQuery.includes('certificate') || lowerQuery.includes('certified') && lowerQuery.includes('copy') || lowerQuery.includes('apostille') || lowerQuery.includes('notarized') || lowerQuery.includes('verified') && lowerQuery.includes('copy') || lowerQuery.includes('authenticated') && lowerQuery.includes('document') || lowerQuery.includes('sealed') && lowerQuery.includes('transcript') || lowerQuery.includes('registrar') && (lowerQuery.includes('transcript') || lowerQuery.includes('certificate')) || lowerQuery.includes('parchment') || lowerQuery.includes('qualification') && lowerQuery.includes('document') || lowerQuery.includes('grade') && lowerQuery.includes('report') || lowerQuery.includes('mark') && lowerQuery.includes('sheet') || (lowerQuery.includes('how') && lowerQuery.includes('get') && (lowerQuery.includes('transcript') || lowerQuery.includes('diploma') || lowerQuery.includes('certificate'))) || (lowerQuery.includes('request') && (lowerQuery.includes('transcript') || lowerQuery.includes('diploma') || lowerQuery.includes('certificate'))) || (lowerQuery.includes('order') && (lowerQuery.includes('transcript') || lowerQuery.includes('diploma') || lowerQuery.includes('certificate'))) || lowerQuery.includes('employer') && (lowerQuery.includes('transcript') || lowerQuery.includes('certificate')) || lowerQuery.includes('job') && (lowerQuery.includes('transcript') || lowerQuery.includes('certificate'))) && key === 'transcripts_diplomas') relevanceScore += 15;
    
    // COMPUTING FACILITIES - Enhanced with IT, technology, and computer access queries
    if ((lowerQuery.includes('computer') || lowerQuery.includes('computers') || lowerQuery.includes('computing') || lowerQuery.includes('it') || lowerQuery.includes('technology') || lowerQuery.includes('tech') || lowerQuery.includes('pc') || lowerQuery.includes('laptop') || lowerQuery.includes('desktop') || lowerQuery.includes('workstation') || lowerQuery.includes('internet') || lowerQuery.includes('wifi') || lowerQuery.includes('wi-fi') || lowerQuery.includes('network') || lowerQuery.includes('access') && (lowerQuery.includes('computer') || lowerQuery.includes('internet') || lowerQuery.includes('it')) || lowerQuery.includes('lab') && lowerQuery.includes('computer') || lowerQuery.includes('computer') && lowerQuery.includes('lab') || lowerQuery.includes('software') || lowerQuery.includes('application') || lowerQuery.includes('program') && lowerQuery.includes('computer') || lowerQuery.includes('print') || lowerQuery.includes('printer') || lowerQuery.includes('printing') || lowerQuery.includes('scan') || lowerQuery.includes('scanner') || lowerQuery.includes('scanning') || lowerQuery.includes('email') || lowerQuery.includes('online') && lowerQuery.includes('access') || lowerQuery.includes('digital') && lowerQuery.includes('resource') || lowerQuery.includes('technical') && lowerQuery.includes('support') || lowerQuery.includes('help') && lowerQuery.includes('desk') || lowerQuery.includes('password') || lowerQuery.includes('login') || lowerQuery.includes('account') && lowerQuery.includes('computer') || lowerQuery.includes('student') && lowerQuery.includes('computer') || lowerQuery.includes('campus') && lowerQuery.includes('computer') || (lowerQuery.includes('where') && lowerQuery.includes('computer')) || (lowerQuery.includes('how') && lowerQuery.includes('access') && lowerQuery.includes('computer')) || (lowerQuery.includes('can') && lowerQuery.includes('use') && lowerQuery.includes('computer')) || lowerQuery.includes('it') && lowerQuery.includes('facilities') || lowerQuery.includes('computing') && lowerQuery.includes('facilities')) && key === 'computing_facilities') relevanceScore += 15;
    
    // COMPLAINTS PROCEDURE - Enhanced with grievance, problem, and dissatisfaction queries
    if ((lowerQuery.includes('complaint') || lowerQuery.includes('complaints') || lowerQuery.includes('complain') || lowerQuery.includes('complaining') || lowerQuery.includes('grievance') || lowerQuery.includes('grievances') || lowerQuery.includes('problem') || lowerQuery.includes('problems') || lowerQuery.includes('issue') || lowerQuery.includes('issues') || lowerQuery.includes('concern') || lowerQuery.includes('concerns') || lowerQuery.includes('dissatisfied') || lowerQuery.includes('dissatisfaction') || lowerQuery.includes('unhappy') || lowerQuery.includes('disappointed') || lowerQuery.includes('upset') || lowerQuery.includes('frustrated') || lowerQuery.includes('angry') || lowerQuery.includes('dispute') || lowerQuery.includes('disagreement') || lowerQuery.includes('conflict') || lowerQuery.includes('unfair') && lowerQuery.includes('treatment') || lowerQuery.includes('poor') && lowerQuery.includes('service') || lowerQuery.includes('bad') && lowerQuery.includes('experience') || lowerQuery.includes('unsatisfactory') || lowerQuery.includes('substandard') || lowerQuery.includes('formal') && lowerQuery.includes('complaint') || lowerQuery.includes('official') && lowerQuery.includes('complaint') || lowerQuery.includes('file') && lowerQuery.includes('complaint') || lowerQuery.includes('lodge') && lowerQuery.includes('complaint') || lowerQuery.includes('submit') && lowerQuery.includes('complaint') || lowerQuery.includes('make') && lowerQuery.includes('complaint') || lowerQuery.includes('report') && (lowerQuery.includes('problem') || lowerQuery.includes('issue') || lowerQuery.includes('concern')) || (lowerQuery.includes('how') && lowerQuery.includes('complain')) || (lowerQuery.includes('where') && lowerQuery.includes('complain')) || (lowerQuery.includes('who') && lowerQuery.includes('complain')) || lowerQuery.includes('feedback') && lowerQuery.includes('negative') || lowerQuery.includes('resolution') || lowerQuery.includes('resolve') && (lowerQuery.includes('problem') || lowerQuery.includes('issue')) || lowerQuery.includes('escalate') || lowerQuery.includes('ombudsman')) && key === 'complaints_procedure') relevanceScore += 15;
    
    // NEW POLICY MATCHING - ENHANCED
    if ((lowerQuery.includes('refund') || lowerQuery.includes('withdraw') || lowerQuery.includes('tuition') || lowerQuery.includes('registration')) && key === 'tuition_fee_refund') relevanceScore += 15;
    if ((lowerQuery.includes('compensation') || lowerQuery.includes('claim') || (lowerQuery.includes('program') && (lowerQuery.includes('cancel') || lowerQuery.includes('terminated') || lowerQuery.includes('terminate'))) || lowerQuery.includes('supervisor') && lowerQuery.includes('leave')) && key === 'student_compensation') relevanceScore += 15;
    if ((lowerQuery.includes('harassment') || lowerQuery.includes('bullying') || lowerQuery.includes('discrimination') || lowerQuery.includes('cyberbullying') || lowerQuery.includes('sexual') || lowerQuery.includes('abuse') || lowerQuery.includes('support') || lowerQuery.includes('gender') || lowerQuery.includes('equality')) && key === 'anti_harassment_policy') relevanceScore += 15;
    if ((lowerQuery.includes('report') && (lowerQuery.includes('harassment') || lowerQuery.includes('discrimination'))) && key === 'anti_harassment_policy') relevanceScore += 20;
    
    // BATCH 2 POLICY MATCHING
    if ((lowerQuery.includes('terms') || lowerQuery.includes('conditions') || lowerQuery.includes('offer') || lowerQuery.includes('admission') || lowerQuery.includes('contract') || lowerQuery.includes('criminal') || lowerQuery.includes('conviction') || lowerQuery.includes('disability') || lowerQuery.includes('immigration') || lowerQuery.includes('visa') || lowerQuery.includes('liability')) && key === 'terms_and_conditions') relevanceScore += 15;
    if ((lowerQuery.includes('privacy') || lowerQuery.includes('data') || lowerQuery.includes('gdpr') || lowerQuery.includes('personal') || lowerQuery.includes('information') || lowerQuery.includes('retention') || lowerQuery.includes('access') || lowerQuery.includes('records')) && key === 'student_privacy_notice') relevanceScore += 15;
    if ((lowerQuery.includes('radicalization') || lowerQuery.includes('extremism') || lowerQuery.includes('extremist') || lowerQuery.includes('terrorism') || lowerQuery.includes('terrorist') || lowerQuery.includes('radical') || lowerQuery.includes('extreme') || lowerQuery.includes('freedom') && lowerQuery.includes('speech') || lowerQuery.includes('vulnerability') || lowerQuery.includes('notice') && lowerQuery.includes('check') && lowerQuery.includes('share')) && key === 'radicalization_prevention') relevanceScore += 15;
    if ((lowerQuery.includes('malpractice') || lowerQuery.includes('wrongdoing') || lowerQuery.includes('whistleblowing') || lowerQuery.includes('misconduct') || lowerQuery.includes('fraud') || lowerQuery.includes('academic') && lowerQuery.includes('freedom') || lowerQuery.includes('disclosure') || (lowerQuery.includes('report') && (lowerQuery.includes('concern') || lowerQuery.includes('problem') || lowerQuery.includes('wrong') || lowerQuery.includes('consequences'))) || lowerQuery.includes('good faith') || lowerQuery.includes('malicious')) && key === 'malpractice_policy') relevanceScore += 15;
    
    // BATCH 3 POLICY MATCHING
    if ((lowerQuery.includes('reference') || lowerQuery.includes('references') || lowerQuery.includes('referee') || lowerQuery.includes('referees') || lowerQuery.includes('recommendation') || lowerQuery.includes('academic') || lowerQuery.includes('professional') || lowerQuery.includes('supervisor') || lowerQuery.includes('employer') || lowerQuery.includes('tutor') || lowerQuery.includes('msc') || lowerQuery.includes('mba') || lowerQuery.includes('master') || lowerQuery.includes('admission') || lowerQuery.includes('admissions') || lowerQuery.includes('application')) && key === 'academic_references') relevanceScore += 15;
    if ((lowerQuery.includes('english') || lowerQuery.includes('language') || lowerQuery.includes('ielts') || lowerQuery.includes('toefl') || lowerQuery.includes('cambridge') || lowerQuery.includes('proficiency') || lowerQuery.includes('cefr') || lowerQuery.includes('c1') || lowerQuery.includes('c2') || lowerQuery.includes('duolingo') || lowerQuery.includes('speaking') || lowerQuery.includes('writing') || lowerQuery.includes('reading') || lowerQuery.includes('listening') || lowerQuery.includes('fluency') || lowerQuery.includes('qualification') || lowerQuery.includes('requirements')) && key === 'english_language_requirements') relevanceScore += 15;
    if ((lowerQuery.includes('appeal') || lowerQuery.includes('appeals') || lowerQuery.includes('complaint') || lowerQuery.includes('complaints') || lowerQuery.includes('dissatisfied') || lowerQuery.includes('unfair') || lowerQuery.includes('review') || lowerQuery.includes('decision') || lowerQuery.includes('rejected') || lowerQuery.includes('denied') || lowerQuery.includes('feedback') || lowerQuery.includes('formal') || lowerQuery.includes('procedure') || lowerQuery.includes('process') || lowerQuery.includes('principal') || lowerQuery.includes('case') && lowerQuery.includes('review')) && key === 'appeals_complaints_procedures') relevanceScore += 15;
    
    // NEW ADMISSION REQUIREMENTS MATCHING
    if ((lowerQuery.includes('undergraduate') || lowerQuery.includes('bachelor') || lowerQuery.includes('bachelors') || lowerQuery.includes('ba') || lowerQuery.includes('bsc') || lowerQuery.includes('high') && lowerQuery.includes('school') || lowerQuery.includes('secondary') || lowerQuery.includes('diploma') || lowerQuery.includes('ib') || lowerQuery.includes('international') && lowerQuery.includes('baccalaureate') || lowerQuery.includes('a level') || lowerQuery.includes('a-level') || lowerQuery.includes('ielts') && lowerQuery.includes('6.0') || lowerQuery.includes('toefl') && lowerQuery.includes('79') || lowerQuery.includes('3 year') || lowerQuery.includes('three year')) && key === 'undergraduate_admission_requirements') relevanceScore += 15;
    if ((lowerQuery.includes('postgraduate') || lowerQuery.includes('master') || lowerQuery.includes('masters') || lowerQuery.includes('msc') || lowerQuery.includes('ma') || lowerQuery.includes('graduate') || lowerQuery.includes('web') && lowerQuery.includes('development') || lowerQuery.includes('artificial') && lowerQuery.includes('intelligence') || lowerQuery.includes('data') && lowerQuery.includes('science') || lowerQuery.includes('translation') || lowerQuery.includes('interpreting') || lowerQuery.includes('greek') && lowerQuery.includes('fluent') || lowerQuery.includes('ielts') && lowerQuery.includes('6.5') || lowerQuery.includes('toefl') && lowerQuery.includes('87') || lowerQuery.includes('two') && lowerQuery.includes('references')) && key === 'postgraduate_admission_requirements') relevanceScore += 15;
    if ((lowerQuery.includes('executive') || lowerQuery.includes('mba') || lowerQuery.includes('emba') || lowerQuery.includes('managerial') || lowerQuery.includes('professional') && lowerQuery.includes('experience') || lowerQuery.includes('work') && lowerQuery.includes('experience') || lowerQuery.includes('3') && lowerQuery.includes('years') || lowerQuery.includes('5') && lowerQuery.includes('years') || lowerQuery.includes('three') && lowerQuery.includes('years') || lowerQuery.includes('five') && lowerQuery.includes('years') || lowerQuery.includes('resume') || lowerQuery.includes('cv') || lowerQuery.includes('one') && lowerQuery.includes('reference') || lowerQuery.includes('internal') && lowerQuery.includes('assessment')) && key === 'executive_mba_admission_requirements') relevanceScore += 15;
    
    // NEW COMPREHENSIVE POLICY MATCHING FOR ADDED REGULATIONS
    
    // Academic Structure & Assessment
    if (((lowerQuery.includes('academic') && lowerQuery.includes('structure')) || lowerQuery.includes('assessment') && lowerQuery.includes('overview') || lowerQuery.includes('stage') || lowerQuery.includes('module') || lowerQuery.includes('credit') || lowerQuery.includes('consolidation') || lowerQuery.includes('reading') && lowerQuery.includes('week') || lowerQuery.includes('10') && lowerQuery.includes('hours') || lowerQuery.includes('depth') || lowerQuery.includes('complexity')) && key === 'academic_structure') relevanceScore += 15;
    
    // Assessment Types
    if (((lowerQuery.includes('assessment') && lowerQuery.includes('type')) || lowerQuery.includes('portfolio') || lowerQuery.includes('essay') || lowerQuery.includes('report') || lowerQuery.includes('literature') && lowerQuery.includes('review') || lowerQuery.includes('case') && lowerQuery.includes('study') || lowerQuery.includes('project') || lowerQuery.includes('self-reflection') || lowerQuery.includes('reflection') || lowerQuery.includes('presentation') || lowerQuery.includes('poster') || lowerQuery.includes('quiz') || lowerQuery.includes('mcq') || lowerQuery.includes('multiple') && lowerQuery.includes('choice') || lowerQuery.includes('assessed') && lowerQuery.includes('lab') || lowerQuery.includes('final') && lowerQuery.includes('exam') || lowerQuery.includes('oral') && lowerQuery.includes('exam') || lowerQuery.includes('viva')) && key === 'assessment_types') relevanceScore += 15;
    
    // Marking Scheme
    if (((lowerQuery.includes('marking') && lowerQuery.includes('scheme')) || lowerQuery.includes('grading') && lowerQuery.includes('system') || lowerQuery.includes('grade') && lowerQuery.includes('system') || lowerQuery.includes('grading') || lowerQuery.includes('grades') || lowerQuery.includes('marking') || lowerQuery.includes('class') && lowerQuery.includes('descriptor') || lowerQuery.includes('40') && lowerQuery.includes('pass') || lowerQuery.includes('70') && lowerQuery.includes('first') || lowerQuery.includes('60') && lowerQuery.includes('69') || lowerQuery.includes('2:1') || lowerQuery.includes('upper') && lowerQuery.includes('second') || lowerQuery.includes('50') && lowerQuery.includes('59') || lowerQuery.includes('2:2') || lowerQuery.includes('lower') && lowerQuery.includes('second') || lowerQuery.includes('third') && lowerQuery.includes('class') || lowerQuery.includes('fail') && lowerQuery.includes('grade') || lowerQuery.includes('excellent') && lowerQuery.includes('analysis') || lowerQuery.includes('strong') && lowerQuery.includes('understanding') || lowerQuery.includes('basic') && lowerQuery.includes('analysis') || lowerQuery.includes('weak') && lowerQuery.includes('understanding') || lowerQuery.includes('first') && lowerQuery.includes('class') || lowerQuery.includes('second') && lowerQuery.includes('class') || lowerQuery.includes('degree') && lowerQuery.includes('classification')) && key === 'marking_scheme') relevanceScore += 15;
    
    // Feedback Policy
    if (((lowerQuery.includes('feedback') && lowerQuery.includes('policy')) || lowerQuery.includes('formative') || lowerQuery.includes('summative') || lowerQuery.includes('3') && lowerQuery.includes('weeks') || lowerQuery.includes('three') && lowerQuery.includes('weeks') || lowerQuery.includes('coursework') && lowerQuery.includes('returned') || lowerQuery.includes('syllabus') || lowerQuery.includes('google') && lowerQuery.includes('classroom') || lowerQuery.includes('aims') || lowerQuery.includes('content') || lowerQuery.includes('methods')) && key === 'feedback_policy') relevanceScore += 15;
    
    // Coursework Submission
    if (((lowerQuery.includes('coursework') && lowerQuery.includes('submission')) || lowerQuery.includes('turnitin') || lowerQuery.includes('cover') && lowerQuery.includes('sheet') || lowerQuery.includes('student') && lowerQuery.includes('id') || lowerQuery.includes('deadline') || lowerQuery.includes('late') && lowerQuery.includes('penalty') || lowerQuery.includes('10') && lowerQuery.includes('marks') && lowerQuery.includes('deducted') || lowerQuery.includes('5') && lowerQuery.includes('days') || lowerQuery.includes('extension') || lowerQuery.includes('illness') && lowerQuery.includes('proof') || lowerQuery.includes('technical') && lowerQuery.includes('issues') || lowerQuery.includes('workload') && lowerQuery.includes('pressure') || lowerQuery.includes('backup')) && key === 'coursework_submission') relevanceScore += 15;
    
    // Examination Process
    if (((lowerQuery.includes('final') && lowerQuery.includes('examination')) || lowerQuery.includes('examination') && lowerQuery.includes('process') || lowerQuery.includes('closed') && lowerQuery.includes('exam') || lowerQuery.includes('week') && lowerQuery.includes('13') || lowerQuery.includes('week') && lowerQuery.includes('14') || lowerQuery.includes('week') && lowerQuery.includes('15') || lowerQuery.includes('resit') && lowerQuery.includes('september') || lowerQuery.includes('handwritten') || lowerQuery.includes('university-provided') && lowerQuery.includes('booklet') || lowerQuery.includes('computer') && lowerQuery.includes('approved') || lowerQuery.includes('invigilated') || lowerQuery.includes('disability') && lowerQuery.includes('arrangement') || lowerQuery.includes('six') && lowerQuery.includes('weeks') && lowerQuery.includes('before')) && key === 'examination_process') relevanceScore += 15;
    
    // Progression Rules
    if (((lowerQuery.includes('progression') && lowerQuery.includes('rules')) || lowerQuery.includes('academic') && lowerQuery.includes('progression') || lowerQuery.includes('next') && lowerQuery.includes('stage') || lowerQuery.includes('graduate') || lowerQuery.includes('pass') && lowerQuery.includes('modules') || lowerQuery.includes('weighted') && lowerQuery.includes('average') || lowerQuery.includes('40%') && lowerQuery.includes('components') || lowerQuery.includes('compensation') || lowerQuery.includes('reassessment')) && key === 'progression_rules') relevanceScore += 15;
    
    // Compensation Rules
    if (((lowerQuery.includes('compensation') && lowerQuery.includes('rules')) || lowerQuery.includes('module') && lowerQuery.includes('compensation') || lowerQuery.includes('failed') && lowerQuery.includes('module') || lowerQuery.includes('30-39%') || lowerQuery.includes('40') && lowerQuery.includes('credits') || lowerQuery.includes('below') && lowerQuery.includes('30') || lowerQuery.includes('below') && lowerQuery.includes('10') || lowerQuery.includes('stage') && lowerQuery.includes('1') || lowerQuery.includes('stage') && lowerQuery.includes('2') || lowerQuery.includes('stage') && lowerQuery.includes('3') || lowerQuery.includes('degree') && lowerQuery.includes('recognition') || lowerQuery.includes('professional') && lowerQuery.includes('bodies')) && key === 'compensation_rules') relevanceScore += 15;
    
    // Reassessment Rules
    if (((lowerQuery.includes('reassessment') && lowerQuery.includes('rules')) || lowerQuery.includes('resit') && lowerQuery.includes('rules') || lowerQuery.includes('90') && lowerQuery.includes('credits') || lowerQuery.includes('50') && lowerQuery.includes('credits') || lowerQuery.includes('below') && lowerQuery.includes('30') || lowerQuery.includes('one') && lowerQuery.includes('reassessment') && lowerQuery.includes('attempt') || lowerQuery.includes('component-based') || lowerQuery.includes('board') && lowerQuery.includes('examiners') || lowerQuery.includes('september') || lowerQuery.includes('original') && lowerQuery.includes('attempt') || lowerQuery.includes('degree') && lowerQuery.includes('calculation')) && key === 'reassessment_rules') relevanceScore += 15;
    
    // Graduation Requirements
    if (((lowerQuery.includes('graduation') && lowerQuery.includes('requirements')) || lowerQuery.includes('graduation') && lowerQuery.includes('classification') || lowerQuery.includes('degree') && lowerQuery.includes('classification') || lowerQuery.includes('grading') && lowerQuery.includes('classification') || lowerQuery.includes('honours') || lowerQuery.includes('360') && lowerQuery.includes('credits') || lowerQuery.includes('480') && lowerQuery.includes('credits') || lowerQuery.includes('3-year') && lowerQuery.includes('programme') || lowerQuery.includes('4-year') && lowerQuery.includes('programme') || lowerQuery.includes('stage') && lowerQuery.includes('2') && lowerQuery.includes('weighted') || lowerQuery.includes('stage') && lowerQuery.includes('3') && lowerQuery.includes('weighted') || lowerQuery.includes('first-class') && lowerQuery.includes('honours') || lowerQuery.includes('upper') && lowerQuery.includes('second') || lowerQuery.includes('lower') && lowerQuery.includes('second') || lowerQuery.includes('third-class') && lowerQuery.includes('honours')) && key === 'graduation_requirements') relevanceScore += 15;
    
    // Class Schedules
    if (((lowerQuery.includes('class') && lowerQuery.includes('schedule')) || lowerQuery.includes('schedule') && lowerQuery.includes('attendance') || lowerQuery.includes('week') && lowerQuery.includes('before') && lowerQuery.includes('semester') || lowerQuery.includes('module') && lowerQuery.includes('names') || lowerQuery.includes('classroom') && lowerQuery.includes('location') || lowerQuery.includes('weekday') || lowerQuery.includes('electronic') || lowerQuery.includes('mandatory') || lowerQuery.includes('lecture') || lowerQuery.includes('tutorial') || lowerQuery.includes('lab') || lowerQuery.includes('first') && lowerQuery.includes('week') || lowerQuery.includes('medical') && lowerQuery.includes('issue') || lowerQuery.includes('public') && lowerQuery.includes('hospital') || lowerQuery.includes('maximum') && lowerQuery.includes('absence') || lowerQuery.includes('exclusion') && lowerQuery.includes('study')) && key === 'class_schedules') relevanceScore += 15;
    
    // Code of Conduct
    if (((lowerQuery.includes('code') && lowerQuery.includes('conduct')) || lowerQuery.includes('student') && lowerQuery.includes('conduct') || lowerQuery.includes('respectful') && lowerQuery.includes('learning') || lowerQuery.includes('scheduled') && lowerQuery.includes('session') || lowerQuery.includes('punctual') || lowerQuery.includes('disrupt') && lowerQuery.includes('class') || lowerQuery.includes('prepared') || lowerQuery.includes('engage') && lowerQuery.includes('actively') || lowerQuery.includes('respect') && lowerQuery.includes('diversity') || lowerQuery.includes('discrimination') && lowerQuery.includes('tolerated') || lowerQuery.includes('mobile') && lowerQuery.includes('phone') || lowerQuery.includes('permission') && lowerQuery.includes('record') || lowerQuery.includes('eating') && lowerQuery.includes('drinking') && lowerQuery.includes('classroom')) && key === 'code_of_conduct') relevanceScore += 15;
    
    // Extenuating Circumstances
    if (((lowerQuery.includes('extenuating') && lowerQuery.includes('circumstances')) || lowerQuery.includes('exceptional') && lowerQuery.includes('circumstances') || lowerQuery.includes('serious') && lowerQuery.includes('personal') || lowerQuery.includes('affect') && lowerQuery.includes('performance') || lowerQuery.includes('claim') || lowerQuery.includes('before') && lowerQuery.includes('assessment') || lowerQuery.includes('serious') && lowerQuery.includes('illness') || lowerQuery.includes('hospitalization') || lowerQuery.includes('mental') && lowerQuery.includes('health') || lowerQuery.includes('family') && lowerQuery.includes('bereavement') || lowerQuery.includes('victim') && lowerQuery.includes('crime') || lowerQuery.includes('transport') && lowerQuery.includes('disruption') || lowerQuery.includes('interview') || lowerQuery.includes('legal') && lowerQuery.includes('proceeding') || lowerQuery.includes('supporting') && lowerQuery.includes('evidence') || lowerQuery.includes('medical') && lowerQuery.includes('document') || lowerQuery.includes('retake') && lowerQuery.includes('assessment') || lowerQuery.includes('extension')) && key === 'extenuating_circumstances') relevanceScore += 15;
    
    // Turnitin Policy
    if (((lowerQuery.includes('turnitin') && lowerQuery.includes('policy')) || lowerQuery.includes('turnitin') && lowerQuery.includes('submission') || lowerQuery.includes('written') && lowerQuery.includes('work') || lowerQuery.includes('plagiarism') && lowerQuery.includes('check') || lowerQuery.includes('collusion') && lowerQuery.includes('check') || lowerQuery.includes('instruction') || lowerQuery.includes('not') && lowerQuery.includes('marked') || lowerQuery.includes('misconduct') && lowerQuery.includes('serious') || lowerQuery.includes('reference') && lowerQuery.includes('job') || lowerQuery.includes('further') && lowerQuery.includes('studies') || lowerQuery.includes('reference') && lowerQuery.includes('properly') || lowerQuery.includes('consult') && lowerQuery.includes('tutor')) && key === 'turnitin_policy') relevanceScore += 15;
    
    // Disciplinary Issues
    if (((lowerQuery.includes('disciplinary') && lowerQuery.includes('issues')) || lowerQuery.includes('student') && lowerQuery.includes('disciplinary') || lowerQuery.includes('disciplinary') && lowerQuery.includes('action') || lowerQuery.includes('department') || lowerQuery.includes('college') || lowerQuery.includes('physical') && lowerQuery.includes('misconduct') || lowerQuery.includes('sexual') && lowerQuery.includes('misconduct') || lowerQuery.includes('abusive') && lowerQuery.includes('behavior') || lowerQuery.includes('threatening') && lowerQuery.includes('behavior') || lowerQuery.includes('disruptive') && lowerQuery.includes('behavior') || lowerQuery.includes('damaging') && lowerQuery.includes('property') || lowerQuery.includes('stealing') && lowerQuery.includes('property') || lowerQuery.includes('health') && lowerQuery.includes('safety') && lowerQuery.includes('risk') || lowerQuery.includes('obstructing') && lowerQuery.includes('college') || lowerQuery.includes('criminal') && lowerQuery.includes('conviction') || lowerQuery.includes('academic') && lowerQuery.includes('misconduct') || lowerQuery.includes('cheating')) && key === 'disciplinary_issues') relevanceScore += 15;
    
    // Withdrawal Policy
    if (((lowerQuery.includes('withdrawal') && lowerQuery.includes('policy')) || lowerQuery.includes('student') && lowerQuery.includes('withdrawal') || lowerQuery.includes('permanently') && lowerQuery.includes('leave') || lowerQuery.includes('withdrawal') || lowerQuery.includes('head') && lowerQuery.includes('department') || lowerQuery.includes('final') && lowerQuery.includes('decision') || lowerQuery.includes('confidential') && lowerQuery.includes('discussion')) && key === 'withdrawal_policy') relevanceScore += 15;
    
    // Campus Resources
    if (((lowerQuery.includes('campus') && lowerQuery.includes('resources')) || lowerQuery.includes('campus') && lowerQuery.includes('building') || lowerQuery.includes('facilities') || lowerQuery.includes('leontos') && lowerQuery.includes('sofou') || lowerQuery.includes('strategakis') || lowerQuery.includes('prox') && lowerQuery.includes('koromila') || lowerQuery.includes('student') && lowerQuery.includes('services') || lowerQuery.includes('it') && lowerQuery.includes('support') || lowerQuery.includes('library') || lowerQuery.includes('classroom') || lowerQuery.includes('l1') || lowerQuery.includes('l2') || lowerQuery.includes('l3') || lowerQuery.includes('l4') || lowerQuery.includes('l5') || lowerQuery.includes('cafe') || lowerQuery.includes('lab') || lowerQuery.includes('ethra') || lowerQuery.includes('thalis') || lowerQuery.includes('auditorium') || lowerQuery.includes('registrar') || lowerQuery.includes('psychology') && lowerQuery.includes('dept') || lowerQuery.includes('neuroscience') && lowerQuery.includes('center') || lowerQuery.includes('executive') && lowerQuery.includes('room') || lowerQuery.includes('a1') || lowerQuery.includes('a2') || lowerQuery.includes('a3') || lowerQuery.includes('financial') && lowerQuery.includes('office') || lowerQuery.includes('counselling')) && key === 'campus_resources') relevanceScore += 15;
    
    // Library ILC
    if (((lowerQuery.includes('information') && lowerQuery.includes('learning') && lowerQuery.includes('commons')) || lowerQuery.includes('ilc') || lowerQuery.includes('multifunctional') && lowerQuery.includes('space') || lowerQuery.includes('library') && lowerQuery.includes('collection') || lowerQuery.includes('library') && lowerQuery.includes('services') && lowerQuery.includes('desk') || lowerQuery.includes('study') && lowerQuery.includes('room') || lowerQuery.includes('silent') || lowerQuery.includes('group') && lowerQuery.includes('study') || lowerQuery.includes('pc-equipped') || lowerQuery.includes('collaborative') && lowerQuery.includes('area') || lowerQuery.includes('social') && lowerQuery.includes('space')) && key === 'library_ilc') relevanceScore += 15;
    
    // Student Office
    if (((lowerQuery.includes('student') && lowerQuery.includes('office') && lowerQuery.includes('support')) || lowerQuery.includes('cultural') || lowerQuery.includes('social') || lowerQuery.includes('academic') && lowerQuery.includes('development') || lowerQuery.includes('personal') && lowerQuery.includes('development') || lowerQuery.includes('visa') || lowerQuery.includes('residence') && lowerQuery.includes('permit') || lowerQuery.includes('housing') || lowerQuery.includes('greek') && lowerQuery.includes('class') || lowerQuery.includes('sport') || lowerQuery.includes('club') || lowerQuery.includes('union') && lowerQuery.includes('support') || lowerQuery.includes('discount') || lowerQuery.includes('personal') && lowerQuery.includes('advising')) && key === 'student_office') relevanceScore += 15;
    
    // Career Office
    if (((lowerQuery.includes('career') && lowerQuery.includes('employability') && lowerQuery.includes('office')) || lowerQuery.includes('career') && lowerQuery.includes('office') || lowerQuery.includes('career') && lowerQuery.includes('planning') || lowerQuery.includes('pursue') && lowerQuery.includes('career') || lowerQuery.includes('cv') || lowerQuery.includes('cover') && lowerQuery.includes('letter') || lowerQuery.includes('interview') && lowerQuery.includes('help') || lowerQuery.includes('career') && lowerQuery.includes('fair') || lowerQuery.includes('internship') || lowerQuery.includes('career') && lowerQuery.includes('goal') || lowerQuery.includes('job') && lowerQuery.includes('application') && lowerQuery.includes('support')) && key === 'career_office') relevanceScore += 15;
    
    // Student Union
    if (((lowerQuery.includes('city') && lowerQuery.includes('student') && lowerQuery.includes('union')) || lowerQuery.includes('csu') || lowerQuery.includes('run') && lowerQuery.includes('students') || lowerQuery.includes('student') && lowerQuery.includes('interest') || lowerQuery.includes('organize') && lowerQuery.includes('activit') || lowerQuery.includes('official') && lowerQuery.includes('student') && lowerQuery.includes('voice') || lowerQuery.includes('election') && lowerQuery.includes('annual') || lowerQuery.includes('representative')) && key === 'student_union') relevanceScore += 15;
    
    // Academic Representatives
    if (((lowerQuery.includes('academic') && lowerQuery.includes('representative')) || lowerQuery.includes('student') && lowerQuery.includes('volunteer') || lowerQuery.includes('represent') && lowerQuery.includes('classmate') || lowerQuery.includes('attend') && lowerQuery.includes('committee') || lowerQuery.includes('senate') && lowerQuery.includes('meeting') || lowerQuery.includes('apply') && lowerQuery.includes('4th') && lowerQuery.includes('week') || lowerQuery.includes('autumn') && lowerQuery.includes('semester') || lowerQuery.includes('demonstrate') && lowerQuery.includes('good') && lowerQuery.includes('conduct') || lowerQuery.includes('improve') && lowerQuery.includes('academic') && lowerQuery.includes('experience')) && key === 'academic_representatives') relevanceScore += 15;
    
    // Student Evaluation
    if (((lowerQuery.includes('student') && lowerQuery.includes('evaluation')) || lowerQuery.includes('feedback') && lowerQuery.includes('system') || lowerQuery.includes('anonymous') && lowerQuery.includes('evaluation') || lowerQuery.includes('seq') || lowerQuery.includes('student') && lowerQuery.includes('evaluation') && lowerQuery.includes('questionnaire') || lowerQuery.includes('improve') && lowerQuery.includes('module') || lowerQuery.includes('improve') && lowerQuery.includes('teaching') || lowerQuery.includes('improve') && lowerQuery.includes('coursework') || lowerQuery.includes('improve') && lowerQuery.includes('feedback') || lowerQuery.includes('college') && lowerQuery.includes('services') || lowerQuery.includes('staff-student') && lowerQuery.includes('forum') || lowerQuery.includes('curriculum') && lowerQuery.includes('service')) && key === 'student_evaluation') relevanceScore += 15;
    
    if (relevanceScore > 0) {
      relevantPolicies.push({
        ...policy,
        key: key,
        relevanceScore: relevanceScore
      });
    }
  }
  
  // Sort by relevance and return top 3
  return relevantPolicies
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3);
}

// GPT-4 RAG System: Main function
async function generateRAGResponse(userQuery, parameters = {}) {
  try {
    console.log(`🔍 RAG Query: "${userQuery}"`);
    
    // Step 1: Retrieve relevant policies
    const relevantPolicies = retrieveRelevantPolicies(userQuery);
    console.log(`📚 Found ${relevantPolicies.length} relevant policies`);
    
    // Step 2: Build context from retrieved policies
    let policyContext = '';
    if (relevantPolicies.length > 0) {
      policyContext = 'RELEVANT UNIVERSITY POLICIES:\n\n';
      relevantPolicies.forEach((policy, index) => {
        policyContext += `${index + 1}. ${policy.title}:\n${policy.content}\n\n`;
      });
    }
    
    // Step 3: Engineer the prompt
    const systemPrompt = buildSystemPrompt(parameters.promptStyle || 'helpful');
    const userPrompt = buildUserPrompt(userQuery, policyContext);
    
    // Step 4: Set parameters (with defaults)
    const apiParameters = {
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: parameters.temperature || 0.2,  // Low for accuracy
      max_tokens: parameters.maxTokens || 1000,
      top_p: parameters.topP || 0.9,
      frequency_penalty: 0,
      presence_penalty: 0
    };
    
    console.log(`🎛️ Using parameters: temp=${apiParameters.temperature}, tokens=${apiParameters.max_tokens}`);
    
    // Step 5: Call GPT-4
            const completion = await getOpenAIClient().chat.completions.create(apiParameters);
    
    const response = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    
    console.log(`✅ GPT-4 response generated (${tokensUsed} tokens used)`);
    
    return {
      success: true,
      response,
      sources: relevantPolicies.map(p => p.title),
      tokensUsed,
      parameters: apiParameters
    };
    
  } catch (error) {
    console.error('❌ GPT-4 RAG Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      fallbackResponse: generateFallbackResponse(userQuery)
    };
  }
}

// Prompt Engineering: Different system prompt styles
function buildSystemPrompt(style = 'helpful') {
  const basePrompt = `You are the official AI assistant for City College Thessaloniki, University of York. Your role is to provide accurate, helpful information about university policies and regulations.`;
  
  const stylePrompts = {
    helpful: `${basePrompt}

INSTRUCTIONS:
- Answer questions using ONLY the provided university policies
- Be helpful, clear, and professional
- If information isn't in the policies, say so clearly
- Provide specific details and cite policy sections when relevant
- Use a friendly but authoritative tone`,

    formal: `${basePrompt}

INSTRUCTIONS:
- Provide formal, official responses based strictly on university policies
- Use precise, professional language
- Cite specific policy sections and regulations
- Maintain official university tone and authority`,

    concise: `${basePrompt}

INSTRUCTIONS:
- Give brief, direct answers based on university policies
- Focus on essential information only
- Be clear and to the point
- Avoid unnecessary elaboration`
  };
  
  return stylePrompts[style] || stylePrompts.helpful;
}

// Build user prompt with context
function buildUserPrompt(userQuery, policyContext) {
  if (policyContext) {
    return `${policyContext}

STUDENT QUESTION: ${userQuery}

Please answer this question based on the university policies provided above. If the answer isn't covered in these policies, please say so.`;
  } else {
    return `STUDENT QUESTION: ${userQuery}

I don't have specific policy information for this question. Please provide a helpful response directing the student to contact the appropriate university department.`;
  }
}

// Fallback response when GPT-4 fails
function generateFallbackResponse(query) {
  return `I apologize, but I'm currently unable to process your question about "${query}" due to a technical issue. 

Please contact City College Thessaloniki, University of York Student Services for immediate assistance:
- Email: studentservices@york.citycollege.eu
- Phone: +44 (0) 1904 717200

For urgent academic matters, you can also visit the Student Services office during office hours.`;
}

module.exports = {
  generateRAGResponse,
  retrieveRelevantPolicies
}; 