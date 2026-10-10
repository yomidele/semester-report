import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createElement } from "react";

export type Lang = "en" | "ha";

const STORAGE_KEY = "public-site-lang";

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "en" || stored === "ha") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Private browsing / storage disabled — language choice just won't persist across visits.
    }
  };

  return createElement(LanguageContext.Provider, { value: { lang, setLang } }, children);
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Every translatable string on the public site, keyed by section. */
const DICT = {
  "layout.nav.home": { en: "Home", ha: "Gida" },
  "layout.nav.about": { en: "About", ha: "Game da Mu" },
  "layout.nav.schools": { en: "Schools", ha: "Makarantu" },
  "layout.nav.classes": { en: "Classes", ha: "Azuzuwa" },
  "layout.nav.subjects": { en: "Subjects", ha: "Darussa" },
  "layout.nav.admissions": { en: "Admissions", ha: "Shiga Makaranta" },
  "layout.nav.news": { en: "News", ha: "Labarai" },
  "layout.nav.checkResult": { en: "Check Result", ha: "Duba Sakamako" },
  "layout.nav.contact": { en: "Contact", ha: "Tuntuɓe Mu" },
  "layout.nav.cdsProject": { en: "CDS Project", ha: "Aikin CDS" },
  "layout.footer.cdsLink": { en: "NYSC Personal CDS Project", ha: "Aikin CDS na Kashin Kai na NYSC" },
  "layout.footer.cdsCredit": {
    en: "School Management System developed by Garba Sadiq Suleman (JG/26A/2107), Batch A2 2026.",
    ha: "Tsarin Gudanar da Makaranta wanda Garba Sadiq Suleman (JG/26A/2107), Batch A2 2026, ya ƙirƙira.",
  },
  "layout.header.checkResult": { en: "Check Result", ha: "Duba Sakamako" },
  "layout.header.applyNow": { en: "Apply Now", ha: "Nemi Shiga Yanzu" },
  "layout.footer.quickLinks": { en: "Quick Links", ha: "Mahaɗan Gaggawa" },
  "layout.footer.portals": { en: "Portals", ha: "Fastoci" },
  "layout.footer.teacherPortal": { en: "Teacher Portal", ha: "Fasto na Malami" },
  "layout.footer.examOfficerPortal": { en: "Exam Officer Portal", ha: "Fasto na Jami'in Jarrabawa" },
  "layout.footer.admissionOfficerPortal": { en: "Admission Officer Portal", ha: "Fasto na Jami'in Shiga Makaranta" },
  "layout.footer.superAdminPortal": { en: "Super Admin Portal", ha: "Fasto na Babban Shugaba" },
  "layout.footer.rights": { en: "All rights reserved.", ha: "Duk hakkoki an kiyaye su." },
  "layout.lang.switchToHausa": { en: "Hausa", ha: "Hausa" },
  "layout.lang.switchToEnglish": { en: "English", ha: "Turanci" },

  // Home
  "home.hero.admissionsOpen": { en: "Admissions open for the new session", ha: "An buɗe shiga makaranta don sabon zangon karatu" },
  "home.hero.admissionsClosed": { en: "Admissions currently closed", ha: "An rufe shiga makaranta a yanzu" },
  "home.hero.tagline": {
    en: "A safe and encouraging place for children to learn, grow in character and build the skills they need for the future.",
    ha: "Wuri mai aminci da ƙarfafawa domin yara su koyi ilimi, su gina halin kirki, su kuma samu ƙwarewar da za su buƙata nan gaba.",
  },
  "home.hero.applyNow": { en: "Apply Now", ha: "Nemi Shiga Yanzu" },
  "home.hero.explorerProgrammes": { en: "Explore Programmes", ha: "Duba Darussa" },
  "home.features.creativeLearning.title": { en: "Creative Learning", ha: "Koyo Mai Kirkira" },
  "home.features.creativeLearning.body": {
    en: "Engaging lessons that help pupils build strong foundations in every subject.",
    ha: "Darussa masu armashi da ke taimaka wa ɗalibai su gina tushe mai ƙarfi a kowane fanni.",
  },
  "home.features.caringTeachers.title": { en: "Caring Teachers", ha: "Malamai Masu Kulawa" },
  "home.features.caringTeachers.body": {
    en: "Teachers work closely with pupils and families to support steady progress.",
    ha: "Malamai suna aiki kafaɗa da kafaɗa da ɗalibai da iyalansu domin tabbatar da ci gaba akai-akai.",
  },
  "home.features.strongFoundations.title": { en: "Strong Foundations", ha: "Tushe Mai Ƙarfi" },
  "home.features.strongFoundations.body": {
    en: "A clear Primary 1–6 learning journey with age-appropriate assessment.",
    ha: "Tsarin karatu bayyananne daga Firamare 1 zuwa 6 tare da jarrabawar da ta dace da shekarun yara.",
  },
  "home.features.characterDevelopment.title": { en: "Character Development", ha: "Gina Halin Kirki" },
  "home.features.characterDevelopment.body": {
    en: "A welcoming school culture that nurtures confidence, respect and responsibility.",
    ha: "Al'adar makaranta mai karɓar baƙi wadda ke gina ƙarfin gwiwa, girmamawa da alhakin kai.",
  },
  "home.lifeAtSchool.kicker": { en: "Life at school", ha: "Rayuwa a Makaranta" },
  "home.lifeAtSchool.heading": { en: "Every morning, a fresh start", ha: "Kowace Safiya, Sabuwar Farawa" },
  "home.lifeAtSchool.body": {
    en: "Our pupils arrive each day to a school that knows them by name, small class arms, attentive form masters, and teachers who track every child's progress closely enough to catch it when they need help, and celebrate it when they excel.",
    ha: "Kowace rana, ɗalibanmu suna zuwa makarantar da ta san su da suna, azuzuwa ƙanana, malaman aji masu kulawa, da malamai da ke bin diddigin ci gaban kowane yaro domin gano idan yana buƙatar taimako, da kuma yaba masa idan ya yi fice.",
  },
  "home.lifeAtSchool.cta": { en: "More about our school", ha: "Ƙara koyo game da makarantarmu" },
  "home.schoolsSection.heading": { en: "Our Schools", ha: "Makarantunmu" },
  "home.schoolsSection.body": {
    en: "Explore our learning sections, primary classes and the subjects that shape each pupil's school journey.",
    ha: "Bincika sassan karatunmu, azuzuwan firamare, da darussan da ke tsara tafiyar karatu ta kowane ɗalibi.",
  },
  "home.schoolsSection.viewAll": { en: "View all schools", ha: "Duba dukkan makarantu" },
  "home.schoolDefaultDescription": { en: "Accredited school section.", ha: "Sashin makaranta da aka amince da shi." },
  "home.programmesSection.heading": { en: "Learning Programmes", ha: "Shirye-shiryen Karatu" },
  "home.programmesSection.seeAll": { en: "See all programmes", ha: "Duba dukkan shirye-shirye" },
  "home.programmeDefaultDescription": { en: "Programme details available on request.", ha: "Ana samun bayanan shirin idan an nema." },
  "home.managementBoard.heading": { en: "School Management Board", ha: "Hukumar Gudanar da Makaranta" },
  "home.managementBoard.body": {
    en: "Meet the team leading our school, from the Head Teacher down to our Exams and Admission Officers.",
    ha: "Ku sadu da tawagar da ke jagorantar makarantarmu, daga Babban Malami zuwa Jami'an Jarrabawa da Shiga Makaranta.",
  },
  "home.admissionReq.heading": { en: "Admission Requirements", ha: "Buƙatun Shiga Makaranta" },
  "home.admissionReq.body": {
    en: "Enrolment is open for children entering the appropriate primary class, subject to available places.",
    ha: "An buɗe rajista ga yaran da za su shiga ajin firamare da ya dace, muddin akwai wurin zama.",
  },
  "home.admissionReq.item1": { en: "Birth certificate or other identification document", ha: "Takardar shaidar haihuwa ko wata takardar shaida" },
  "home.admissionReq.item2": { en: "Recent passport photograph", ha: "Sabon hoton fasfo" },
  "home.admissionReq.item3": { en: "Completed application and admission screening", ha: "Cikakkiyar takardar nema da aka duba" },
  "home.admissionReq.item4": { en: "Parent or guardian contact information", ha: "Bayanan tuntuɓar iyaye ko mai kula" },

  // Home — NYSC CDS project card
  "home.cds.kicker": { en: "NYSC Personal CDS Project", ha: "Aikin CDS na Kashin Kai na NYSC" },
  "home.cds.heading": { en: "The story behind this School Management System", ha: "Labarin da ke bayan wannan Tsarin Gudanar da Makaranta" },
  "home.cds.body": {
    en: "Designed and developed for our school by Garba Sadiq Suleman, an NYSC Corps Member, as a Personal Community Development Service project.",
    ha: "Garba Sadiq Suleman, ɗan bautar ƙasa na NYSC, ne ya tsara kuma ya ƙirƙiri wannan tsari don makarantarmu a matsayin aikin Hidimar Raya Al'umma na kashin kansa.",
  },
  "home.hero.imageAlt": { en: "Smiling pupils in uniform arriving at school with their backpacks", ha: "Yara masu murmushi cikin kayan makaranta suna isowa makaranta da jakunkunansu" },
  "home.lifeAtSchool.imageAlt": { en: "Pupils in uniform walking together at school, smiling", ha: "Yara cikin kayan makaranta suna tafiya tare a makaranta, suna murmushi" },
  "staff.category.head_teacher": { en: "Head Teacher", ha: "Shugaban Makaranta" },
  "staff.category.vice_head_teacher": { en: "Assistant Head Teacher", ha: "Mataimakin Shugaban Makaranta" },
  "staff.category.exams_officer": { en: "Exams Officer", ha: "Jami'in Jarrabawa" },
  "staff.category.admission_officer": { en: "Admission Officer", ha: "Jami'in Shiga Makaranta" },
  "staff.category.teacher": { en: "Teacher", ha: "Malami" },
  "staff.category.staff": { en: "Staff", ha: "Ma'aikaci" },
  "about.image1Alt": { en: "A teacher addressing pupils gathered under a tree on the school compound", ha: "Malami yana yi wa yara jawabi a ƙarƙashin itace a harabar makaranta" },
  "about.image2Alt": { en: "A group of our pupils in school uniform standing together on the compound", ha: "Gungun ɗalibanmu cikin kayan makaranta suna tsaye tare a harabar makaranta" },
  "cds.imageAlt": { en: "Garba Sadiq Suleman, NYSC Corps Member, in full NYSC uniform", ha: "Garba Sadiq Suleman, ɗan bautar ƙasa na NYSC, cikin cikakken kayan NYSC" },
  "layout.switchLanguage": { en: "Switch language", ha: "Canza harshe" },
  "layout.toggleMenu": { en: "Toggle menu", ha: "Buɗe ko rufe menu" },
  "layout.account": { en: "Account", ha: "Asusu" },
  "apply.photoRequired": { en: "Please add the pupil's passport photograph before submitting.", ha: "Da fatan za a saka hoton fasfo na yaron kafin a aika." },
  "title.about": { en: "About Model Day Primary School Kazaure", ha: "Game da Model Day Primary School Kazaure" },
  "title.schools": { en: "Schools — Academic Divisions of the College", ha: "Makarantu — Sassan Ilimi na Kwalejin" },
  "title.programmes": { en: "Programmes — 2, 3 and 4 Year Health Subjects", ha: "Shirye-shirye — Darussan Lafiya na Shekara 2, 3 da 4" },
  "title.departments": { en: "Classes — Model Day Primary School Kazaure", ha: "Azuzuwa — Model Day Primary School Kazaure" },
  "title.admissions": { en: "Admissions — Apply to the College", ha: "Shiga Makaranta — Nemi Shiga Kwalejin" },
  "title.apply": { en: "Apply for Admission — School Portal", ha: "Nemi Shiga Makaranta — Tashar Makaranta" },
  "title.news": { en: "News & Events", ha: "Labarai da Abubuwan da ke Faruwa" },
  "title.contact": { en: "Contact the College", ha: "Tuntuɓi Kwalejin" },
  "title.cds": { en: "NYSC Personal CDS Project — Model Day Primary School Kazaure", ha: "Aikin CDS na Kashin Kai na NYSC — Model Day Primary School Kazaure" },
  "title.checkResult": { en: "Check Result — School Portal", ha: "Duba Sakamako — Tashar Makaranta" },
  "title.buyPin": { en: "Buy Result PIN — School Portal", ha: "Sayi PIN na Sakamako — Tashar Makaranta" },
  "title.paymentConfirm": { en: "Payment Confirmation — School Portal", ha: "Tabbatar da Biyan Kuɗi — Tashar Makaranta" },
  "home.cds.cta": { en: "Click to view more", ha: "Danna don ganin ƙari" },
  "home.cds.ariaLabel": { en: "View more about the NYSC Personal CDS Project", ha: "Duba ƙarin bayani game da Aikin CDS na Kashin Kai na NYSC" },

  // CDS project page
  "cds.hero.kicker": { en: "Community Development Service", ha: "Hidimar Raya Al'umma" },
  "cds.hero.title": { en: "NYSC Personal CDS Project", ha: "Aikin CDS na Kashin Kai na NYSC" },
  "cds.hero.tagline": { en: "School Management System — developed for", ha: "Tsarin Gudanar da Makaranta — an ƙirƙira shi don" },
  "cds.profile.kicker": { en: "Developer Profile", ha: "Bayanin Mai Ƙirƙira" },
  "cds.profile.role": { en: "NYSC Corps Member & Project Developer", ha: "Ɗan Bautar Ƙasa na NYSC & Mai Ƙirƙirar Aikin" },
  "cds.label.stateCode": { en: "NYSC State Code", ha: "Lambar Jiha ta NYSC" },
  "cds.label.ppa": { en: "PPA", ha: "Wurin Aiki (PPA)" },
  "cds.label.location": { en: "Location", ha: "Wuri" },
  "cds.label.serviceYear": { en: "Service Year", ha: "Shekarar Bauta" },
  "cds.desc.kicker": { en: "Project Description", ha: "Bayanin Aikin" },
  "cds.desc.p1": {
    en: "This School Management System was designed and developed for Model Day Primary School Kazaure as a Personal Community Development Service (CDS) project by Garba Sadiq Suleman, an NYSC Corps Member serving at the school as part of Batch A2 2026.",
    ha: "Garba Sadiq Suleman, ɗan bautar ƙasa na NYSC da ke aiki a makarantar a ƙarƙashin Batch A2 2026, ne ya tsara kuma ya ƙirƙiri wannan Tsarin Gudanar da Makaranta don Model Day Primary School Kazaure a matsayin aikin Hidimar Raya Al'umma (CDS) na kashin kansa.",
  },
  "cds.desc.p2": {
    en: "The project was developed to support the school's academic and administrative activities through digital management of student records, staff information, classes, subjects, attendance, examinations, results, report cards, admissions, and other relevant school operations.",
    ha: "An ƙirƙiri aikin ne domin tallafa wa ayyukan ilimi da gudanarwa na makarantar ta hanyar sarrafa bayanan ɗalibai, bayanan ma'aikata, azuzuwa, darussa, halarta, jarrabawa, sakamako, rahotannin makaranta, shiga makaranta, da sauran ayyukan makaranta masu muhimmanci ta hanyar dijital.",
  },
  "cds.desc.p3": {
    en: "The goal of the project is to contribute to the digital development of the school, improve record keeping, reduce reliance on manual processes, and provide authorized school personnel with a centralized platform for managing school information.",
    ha: "Manufar aikin ita ce ba da gudummawa ga ci gaban makarantar ta hanyar fasahar dijital, inganta adana bayanai, rage dogaro da hanyoyin hannu, da samar wa ma'aikatan makaranta masu izini wuri guda na sarrafa bayanan makaranta.",
  },
  "cds.info.kicker": { en: "Project Information", ha: "Bayanan Aikin" },
  "cds.info.project": { en: "Project", ha: "Aiki" },
  "cds.info.projectValue": { en: "School Management System", ha: "Tsarin Gudanar da Makaranta" },
  "cds.info.projectType": { en: "Project Type", ha: "Nau'in Aiki" },
  "cds.info.projectTypeValue": { en: "NYSC Personal CDS", ha: "CDS na Kashin Kai na NYSC" },
  "cds.info.developer": { en: "Developer", ha: "Mai Ƙirƙira" },
  "cds.dev.kicker": { en: "Project Developer", ha: "Mai Ƙirƙirar Aikin" },
  "cds.dev.role": { en: "NYSC Corps Member — Batch A2 2026", ha: "Ɗan Bautar Ƙasa na NYSC — Batch A2 2026" },
  "cds.dev.quote": {
    en: "Designed and developed by Garba Sadiq Suleman as an NYSC Personal CDS project in service to education and community development.",
    ha: "Garba Sadiq Suleman ne ya tsara kuma ya ƙirƙira shi a matsayin aikin CDS na kashin kai na NYSC domin hidima ga ilimi da raya al'umma.",
  },

  // About
  "about.hero.title": { en: "About Our School", ha: "Game da Makarantarmu" },
  "about.intro.p1": {
    en: "sits in the heart of Kazaure, and for years families here have trusted us with something that matters a great deal to them: their children's first real steps into learning. We are a full primary school, taking pupils from Nursery through to Primary 6, and every one of our classes is run by teachers who know the difference between a child who is struggling quietly and one who is simply bored and needs to be stretched further.",
    ha: "tana nan a tsakiyar Kazaure, kuma shekaru da yawa iyalai a nan sun amince mana da wani abu mai muhimmanci a gare su: matakan farko na ainihi na koyo ga 'ya'yansu. Mu cikakkiyar makarantar firamare ce, muna karɓar ɗalibai daga Nursery har zuwa Firamare 6, kuma kowane aji namu malamai ne ke gudanar da shi waɗanda suka san bambanci tsakanin yaron da ke fama a shiru da wanda kawai ya gaji kuma yake buƙatar ƙarin ƙalubale.",
  },
  "about.intro.p2": {
    en: "Our classrooms are not large by design — we keep class sizes manageable so that no pupil disappears into the back row. Mornings begin with assembly, where the whole school gathers under the trees on our compound before lessons start. It is a small ritual, but it sets the tone: this is a place where pupils are known by name, not just by number.",
    ha: "Azuzuwanmu ba manya ba ne da gangan — muna kiyaye yawan ɗalibai a kowane aji domin kada wani ɗalibi ya ɓace a bayan aji. Safiya kan fara ne da taro, inda dukkan makarantar ke taruwa ƙarƙashin bishiyoyi a filin makarantarmu kafin fara darussa. Ƙaramin al'ada ce, amma tana nuna yanayin makarantar: wannan wuri ne da ake sanin ɗalibai da suna, ba kawai da lamba ba.",
  },
  "about.intro.p3": {
    en: "Alongside Mathematics, English and the core primary curriculum, we place real weight on Qur'anic and Islamic studies, handwriting, and the kind of discipline that carries a child well beyond our gates — punctuality, respect for teachers and elders, and taking care of shared property. We work closely with parents and guardians, because a school report only tells half the story; the rest happens at home, and we take that partnership seriously.",
    ha: "Baya ga Lissafi, Turanci da manyan darussan firamare, muna ba da muhimmanci sosai ga karatun Alƙur'ani da Addinin Musulunci, rubutun hannu, da irin horon da ke tafiya tare da yaro har bayan ƙofofinmu — zuwa kan lokaci, girmama malamai da manya, da kula da kayan gama-gari. Muna aiki kafaɗa da kafaɗa da iyaye da masu kula, domin rahoton makaranta kawai rabin labarin ne; sauran yana faruwa ne a gida, kuma muna ɗaukar wannan haɗin kai da muhimmanci.",
  },
  "about.mission.title": { en: "Our Mission", ha: "Manufarmu" },
  "about.mission.body": {
    en: "To give every child who passes through our gates a solid academic foundation, sound moral character, and the confidence to keep learning long after they leave Primary 6.",
    ha: "Mu ba kowane yaro da ya shiga ƙofofinmu tushen ilimi mai ƙarfi, kyakkyawan hali, da ƙarfin gwiwa na ci gaba da koyo bayan ya bar Firamare 6.",
  },
  "about.vision.title": { en: "Our Vision", ha: "Hangen Nesanmu" },
  "about.vision.body": {
    en: "To be the primary school families in Kazaure recommend to one another — known for pupils who read well, count well, and carry themselves with good character.",
    ha: "Mu zama makarantar firamare da iyalai a Kazaure ke ba juna shawara — sanannu da ɗalibai masu kyawun karatu, ƙidaya, da halin kirki.",
  },
  "about.standards.title": { en: "Our Standards", ha: "Ƙa'idojinmu" },
  "about.standards.body": {
    en: "Attendance is tracked, results are recorded honestly term by term, and every class has a form master parents can reach directly with questions about their child.",
    ha: "Ana bin diddigin halarta, ana rubuta sakamako da gaskiya a kowane zango, kuma kowane aji yana da malamin aji da iyaye za su iya tuntuɓa kai tsaye don tambayoyi game da ɗansu.",
  },
  "about.lifeAtSchool.p1": {
    en: "Every term ends the same way for every pupil: a proper report card, filled in by their own class teacher, showing exactly how they performed in each subject and how their attendance looked over the term. Parents don't have to guess — they can see it in black and white, and they're welcome to come in and discuss it with the form master directly.",
    ha: "Kowane zango yana ƙarewa iri ɗaya ga kowane ɗalibi: sahihin rahoton makaranta, wanda malamin ajinsa ya cika, yana nuna ainihin yadda ya yi a kowane fanni da kuma yadda halartarsa ta kasance a cikin zangon. Iyaye ba sa buƙatar tsammani — za su iya ganin shi a bayyane, kuma suna maraba da zuwa domin tattaunawa da malamin aji kai tsaye.",
  },
  "about.lifeAtSchool.p2": {
    en: "We are still a growing school, and we don't pretend otherwise. What we can promise is that the people teaching your child live in this community, answer to a Head Teacher who is genuinely reachable, and take it personally when a pupil falls behind. That is the standard we hold ourselves to, term after term.",
    ha: "Har yanzu muna cikin ci gaba a matsayin makaranta, kuma ba ma ɓoye hakan. Abin da za mu iya alkawartawa shi ne mutanen da ke koyar da ɗanka suna zaune a cikin wannan al'umma, suna amsa ga Babban Malami wanda ake iya samu cikin sauƙi, kuma suna ɗaukar lamari da muhimmanci idan ɗalibi ya faɗi baya. Wannan shi ne ƙa'idar da muke riƙe wa kanmu, zango bayan zango.",
  },
  "about.quickFacts.nurseryToPrimary6": { en: "Nursery through Primary 6", ha: "Daga Nursery zuwa Firamare 6" },
  "about.quickFacts.smallClasses": { en: "Small classes, known by name", ha: "Azuzuwa ƙanana, ana sani da suna" },
  "about.quickFacts.basedInKazaure": { en: "Based in Kazaure, Jigawa State", ha: "Tana a Kazaure, Jihar Jigawa" },

  // Admissions
  "admissions.hero.title": { en: "Admissions", ha: "Shiga Makaranta" },
  "admissions.hero.tagline": { en: "Begin your journey at", ha: "Fara tafiyarka a" },
  "admissions.hero.taglineEnd": { en: "and prepare for meaningful work in healthcare.", ha: "kuma ka shirya don aiki mai amfani a fannin kiwon lafiya." },
  "admissions.requirements.kicker": { en: "Entry requirements", ha: "Buƙatun Shiga" },
  "admissions.requirements.heading": { en: "What you need to apply", ha: "Abin da ake buƙata don neman shiga" },
  "admissions.requirements.body": {
    en: "Requirements may vary by programme. Review the subject details and contact the college before submitting your application.",
    ha: "Buƙatun na iya bambanta bisa ga shiri. Duba cikakkun bayanan fanni kuma ka tuntuɓi makarantar kafin ka miƙa takardar nemanka.",
  },
  "admissions.readyToApply.title": { en: "Ready to apply?", ha: "Shirye don nema?" },
  "admissions.readyToApply.body": {
    en: "Application instructions and screening dates are available from the admissions office.",
    ha: "Ana samun umarnin neman shiga da ranakun bincike daga ofishin shiga makaranta.",
  },
  "admissions.readyToApply.start": { en: "Start application", ha: "Fara Takardar Nema" },
  "admissions.readyToApply.browse": { en: "Browse programmes", ha: "Duba Shirye-shirye" },
  "admissions.durations.kicker": { en: "Programme durations", ha: "Tsawon Lokacin Shirye-shirye" },
  "admissions.durations.heading": { en: "Choose your path", ha: "Zaɓi Hanyarka" },
  "admissions.durations.loading": { en: "Loading programmes...", ha: "Ana lodin shirye-shirye…" },
  "admissions.durations.empty": { en: "Programme information is currently unavailable.", ha: "Babu bayanan shiri a yanzu." },
  "admissions.faq.heading": { en: "Frequently asked questions", ha: "Tambayoyin da Ake Yawan Yi" },
  "admissions.faq.q1": { en: "How long do the programmes take?", ha: "Tsawon lokacin shirye-shiryen nawa ne?" },
  "admissions.faq.a1": {
    en: "Programme duration depends on the award and subject. Check the programme list below for the current duration of each active programme.",
    ha: "Tsawon lokacin shiri ya dogara da takardar shaida da fanni. Duba jerin shirye-shirye a ƙasa domin tsawon lokacin kowane shiri mai aiki a yanzu.",
  },
  "admissions.faq.q2": { en: "Can I apply before the next session opens?", ha: "Zan iya nema kafin sabon zango ya buɗe?" },
  "admissions.faq.a2": {
    en: "You can contact the college for application dates and guidance on the next available admission cycle.",
    ha: "Za ka iya tuntuɓar makarantar domin ranakun nema da jagora kan zagayen shiga makaranta na gaba.",
  },
  "admissions.faq.q3": { en: "What should I bring for screening?", ha: "Me ya kamata in kawo don bincike?" },
  "admissions.faq.a3": {
    en: "Bring your academic credentials and any other documents requested in the current admission notice. Contact the college if you need a complete checklist.",
    ha: "Kawo takardun shaidar ilimi da duk wasu takardun da aka buƙata a sanarwar shiga makaranta ta yanzu. Tuntuɓi makarantar idan kana buƙatar cikakken jerin abubuwan buƙata.",
  },
  "admissions.req1": { en: "Five O'Level credits including English Language and Mathematics", ha: "Credits biyar na O'Level har da Harshen Turanci da Lissafi" },
  "admissions.req2": { en: "Credits in Biology, Chemistry and Physics for science-based programmes", ha: "Credits a Ilmin Halitta, Chemistry da Physics don shirye-shiryen kimiyya" },
  "admissions.req3": { en: "Completed application and screening process", ha: "Cikakkiyar takardar nema da aikin bincike" },
  "admissions.req4": { en: "Medical fitness certificate before clinical postings", ha: "Takardar shaidar lafiya kafin aikin asibiti" },

  // Schools
  "schools.hero.title": { en: "Our Schools", ha: "Makarantunmu" },
  "schools.hero.tagline": {
    en: "Each school groups related departments and programmes under one academic leadership.",
    ha: "Kowace makaranta tana tattara sassa da shirye-shirye masu alaƙa a ƙarƙashin jagoranci ɗaya.",
  },
  "schools.loading": { en: "Loading schools…", ha: "Ana lodin makarantu…" },
  "schools.classesHeading": { en: "Classes", ha: "Azuzuwa" },
  "schools.defaultDescription": { en: "Accredited school of the college.", ha: "Makarantar da aka amince da ita." },

  // Classes / Departments
  "departments.hero.title": { en: "Classes", ha: "Azuzuwa" },
  "departments.hero.tagline": {
    en: "Classes provide a supportive learning environment for every child.",
    ha: "Azuzuwa suna ba da yanayin koyo mai taimako ga kowane yaro.",
  },
  "departments.loading": { en: "Loading departments…", ha: "Ana lodin azuzuwa…" },
  "departments.defaultSchool": { en: "College", ha: "Makaranta" },
  "departments.defaultDescription": { en: "Class of the college.", ha: "Ajin makaranta." },

  // Programmes
  "programmes.hero.title": { en: "Programmes", ha: "Shirye-shirye" },
  "programmes.hero.tagline": {
    en: "Programme lengths vary by award — no programme is fixed to a single duration.",
    ha: "Tsawon shirye-shirye ya bambanta bisa ga takardar shaida — babu shirin da aka ɗaure shi da tsawon lokaci guda.",
  },
  "programmes.searchPlaceholder": { en: "Search programmes…", ha: "Nemi shirye-shirye…" },
  "programmes.allDurations": { en: "All durations", ha: "Dukkan Tsawon Lokaci" },
  "programmes.loading": { en: "Loading programmes…", ha: "Ana lodin shirye-shirye…" },
  "programmes.empty": { en: "No programmes match your search.", ha: "Babu shirin da ya dace da binciken ka." },
  "programmes.defaultDescription": { en: "Programme details available on request.", ha: "Ana samun bayanan shirin idan an nema." },
  "programmes.school": { en: "School:", ha: "Makaranta:" },
  "programmes.class": { en: "Class:", ha: "Aji:" },
  "programmes.unitsPerSemester": { en: "Units per semester:", ha: "Darussa a kowane zango:" },
  "programmes.entry": { en: "Entry:", ha: "Shiga:" },
  "programmes.applyForThis": { en: "Apply for this programme", ha: "Nemi Shiga wannan Shiri" },

  // Apply
  "apply.hero.title": { en: "Apply for Admission", ha: "Nemi Shiga Makaranta" },
  "apply.hero.tagline": {
    en: "Choose the class you're applying for, then complete the applicant form below. An Admission Officer will review your application and contact you.",
    ha: "Zaɓi ajin da kake neman shiga, sannan ka cika fom ɗin mai nema a ƙasa. Jami'in Shiga Makaranta zai duba takardar nemanka kuma ya tuntuɓe ka.",
  },
  "apply.closed.title": { en: "Admissions are currently closed", ha: "An Rufe Shiga Makaranta a Yanzu" },
  "apply.closed.body": {
    en: "We aren't accepting new applications right now. Please check back later, or contact the school office for enquiries.",
    ha: "Ba ma karɓar sabbin takardun nema a yanzu. Da fatan za ku dawo daga baya, ko ku tuntuɓi ofishin makaranta don tambayoyi.",
  },
  "apply.returnHome": { en: "Return home", ha: "Koma Gida" },
  "apply.chooser.tagline": {
    en: "Select the section and class you're applying to. Admission requirements can vary slightly by section, so pick carefully.",
    ha: "Zaɓi sashe da ajin da kake neman shiga. Buƙatun shiga na iya bambanta kaɗan bisa ga sashe, saboda haka ka zaɓi a hankali.",
  },
  "apply.chooser.noneOpen": { en: "Admissions aren't open for any class right now. Check the", ha: "Babu wani aji da aka buɗe shiga a yanzu. Duba shafin" },
  "apply.chooser.newsAndEvents": { en: "News & Events", ha: "Labarai da Abubuwan Faruwa" },
  "apply.chooser.forIntake": { en: "page for the next intake announcement.", ha: "domin sanarwar shiga makaranta na gaba." },
  "apply.success.title": { en: "Application received", ha: "An Karɓi Takardar Nema" },
  "apply.success.bodyStart": { en: "Your applicant number is", ha: "Lambar takardar nemanka ita ce" },
  "apply.success.bodyEnd": {
    en: "Keep it for future enquiries — an Admission Officer will review your application and reach out using the contact details you provided.",
    ha: "Ka ajiye ta don tambayoyi nan gaba — Jami'in Shiga Makaranta zai duba takardar nemanka kuma ya tuntuɓe ka ta hanyar bayanan tuntuɓar da ka bayar.",
  },
  "apply.success.applyAnother": { en: "Apply for another class", ha: "Nemi Shiga Wani Aji" },
  "apply.form.chooseDifferent": { en: "Choose a different class", ha: "Zaɓi Wani Aji" },
  "apply.form.heading": { en: "Pupil & guardian details", ha: "Bayanan Ɗalibi da Mai Kula" },
  "apply.form.applyingFor": { en: "Applying for", ha: "Neman shiga" },
  "apply.form.pupilPhoto": { en: "Pupil's passport photograph", ha: "Hoton Fasfo na Ɗalibi" },
  "apply.form.pupilFullName": { en: "Pupil's full name", ha: "Cikakken Sunan Ɗalibi" },
  "apply.form.dateOfBirth": { en: "Date of birth", ha: "Ranar Haihuwa" },
  "apply.form.gender": { en: "Gender", ha: "Jinsi" },
  "apply.form.selectGender": { en: "Select gender", ha: "Zaɓi Jinsi" },
  "apply.form.female": { en: "Female", ha: "Mace" },
  "apply.form.male": { en: "Male", ha: "Namiji" },
  "apply.form.previousSchool": { en: "Previous school (if any)", ha: "Makarantar Da Ya Taɓa Zuwa (idan akwai)" },
  "apply.form.guardianName": { en: "Parent/Guardian name", ha: "Sunan Iyaye/Mai Kula" },
  "apply.form.guardianPhone": { en: "Parent/Guardian phone", ha: "Lambar Wayar Iyaye/Mai Kula" },
  "apply.form.guardianEmail": { en: "Parent/Guardian email", ha: "Imel na Iyaye/Mai Kula" },
  "apply.form.stateOfOrigin": { en: "State of origin", ha: "Jihar Asali" },
  "apply.form.homeAddress": { en: "Home address", ha: "Adireshin Gida" },
  "apply.form.submit": { en: "Submit application", ha: "Miƙa Takardar Nema" },

  // Contact
  "contact.hero.title": { en: "Contact the College", ha: "Tuntuɓi Makarantar" },
  "contact.hero.tagline": {
    en: "Questions about admissions, programmes or student services? We are here to help.",
    ha: "Tambayoyi game da shiga makaranta, shirye-shirye ko ayyukan ɗalibai? Muna nan domin taimaka maka.",
  },
  "contact.getInTouch.heading": { en: "Get in touch", ha: "Tuntuɓe Mu" },
  "contact.getInTouch.body": {
    en: "Reach the college through the details below or send a message to the support team.",
    ha: "Ka tuntuɓi makarantar ta hanyar bayanan da ke ƙasa ko ka aika saƙo zuwa ƙungiyar taimako.",
  },
  "contact.address": { en: "Address", ha: "Adireshi" },
  "contact.phone": { en: "Phone", ha: "Waya" },
  "contact.email": { en: "Email", ha: "Imel" },
  "contact.mapPlaceholder": { en: "Map location will appear here", ha: "Wurin taswira zai bayyana nan" },
  "contact.form.heading": { en: "Send an enquiry", ha: "Aika Tambaya" },
  "contact.form.name": { en: "Name", ha: "Suna" },
  "contact.form.email": { en: "Email", ha: "Imel" },
  "contact.form.phone": { en: "Phone", ha: "Waya" },
  "contact.form.message": { en: "Message", ha: "Saƙo" },
  "contact.form.send": { en: "Send message", ha: "Aika Saƙo" },
  "contact.form.sent": {
    en: "Your message has been recorded on this page. We will be in touch through the details provided.",
    ha: "An rubuta saƙonka a wannan shafin. Za mu tuntuɓe ka ta hanyar bayanan da aka bayar.",
  },

  // News
  "news.hero.title": { en: "News & Events", ha: "Labarai da Abubuwan Faruwa" },
  "news.hero.tagline": {
    en: "Admission notices, campus updates and events from across the college.",
    ha: "Sanarwar shiga makaranta, sabuntawar makaranta da abubuwan faruwa daga ko'ina a makarantar.",
  },
  "news.empty.title": { en: "No posts yet", ha: "Babu Labari Tukuna" },
  "news.empty.body": {
    en: "Check back soon — admissions notices and campus news will appear here as they're published.",
    ha: "Dawo nan ba da jimawa ba — sanarwar shiga makaranta da labaran makaranta za su bayyana nan yayin da aka buga su.",
  },
  "news.readMore": { en: "Read More", ha: "Ƙara Karantawa" },
  "news.category.news": { en: "News", ha: "Labari" },
  "news.category.event": { en: "Event", ha: "Taron" },
  "news.category.announcement": { en: "Announcement", ha: "Sanarwa" },
  "news.post.notFound.title": { en: "Post not found", ha: "Ba a Sami Labari Ba" },
  "news.post.notFound.body": { en: "This post may have been removed or unpublished.", ha: "Wataƙila an cire wannan labari ko ba a buga shi ba." },
  "news.post.backToNews": { en: "Back to News", ha: "Koma zuwa Labarai" },
  "news.post.by": { en: "By", ha: "Daga" },

  // Check result
  "checkResult.hero.title": { en: "Check Your Result", ha: "Duba Sakamakonka" },
  "checkResult.hero.tagline": {
    en: "Enter your details and Result PIN below to view your published result.",
    ha: "Shigar da bayananka da PIN ɗin Sakamako a ƙasa domin duba sakamakonka da aka buga.",
  },
  "checkResult.cardTitle": { en: "Check Result", ha: "Duba Sakamako" },
  "checkResult.admissionNo": { en: "Pupil / Admission No.", ha: "Lambar Ɗalibi / Shiga Makaranta" },
  "checkResult.resultPin": { en: "Result PIN", ha: "PIN na Sakamako" },
  "checkResult.academicSession": { en: "Academic Session", ha: "Zangon Karatu" },
  "checkResult.selectSession": { en: "Select session", ha: "Zaɓi Zango" },
  "checkResult.term": { en: "Term", ha: "Lokaci" },
  "checkResult.selectTerm": { en: "Select term", ha: "Zaɓi Lokaci" },
  "checkResult.firstTerm": { en: "First Term", ha: "Lokaci na Farko" },
  "checkResult.secondTerm": { en: "Second Term", ha: "Lokaci na Biyu" },
  "checkResult.thirdTerm": { en: "Third Term", ha: "Lokaci na Uku" },
  "checkResult.submit": { en: "Check Result", ha: "Duba Sakamako" },
  "checkResult.noPin": { en: "Don't have a PIN?", ha: "Ba ka da PIN?" },
  "checkResult.buyPin": { en: "Buy Result PIN", ha: "Sayi PIN na Sakamako" },
  "checkResult.selectSessionTermError": { en: "Select the academic session and term.", ha: "Zaɓi zangon karatu da lokaci." },
  "checkResult.table.code": { en: "Code", ha: "Lamba" },
  "checkResult.table.subjectTitle": { en: "Subject Title", ha: "Sunan Fanni" },
  "checkResult.table.ca": { en: "CA", ha: "CA" },
  "checkResult.table.exam": { en: "Exam", ha: "Jarrabawa" },
  "checkResult.table.total": { en: "Total", ha: "Jimla" },
  "checkResult.table.grade": { en: "Grade", ha: "Daraja" },
  "checkResult.pinUsage": { en: "PIN usage:", ha: "Yin amfani da PIN:" },
  "checkResult.views": { en: "views", ha: "duba" },
  "checkResult.verificationNo": { en: "Verification No.", ha: "Lambar Tabbatarwa" },
  "checkResult.downloadReportCard": { en: "Download Official Report Card", ha: "Sauke Rahoton Makaranta na Hukuma" },

  // Result PIN buy
  "resultPin.hero.title": { en: "Buy Result PIN", ha: "Sayi PIN na Sakamako" },
  "resultPin.hero.tagline": {
    en: "Purchase a secure PIN to check and download your result online.",
    ha: "Sayi amintaccen PIN domin duba da sauke sakamakonka a yanar gizo.",
  },
  "resultPin.notConfigured": {
    en: "Online payment isn't configured yet on this server. Visit the registry to request a PIN in person.",
    ha: "Ba a saita biyan kuɗi ta yanar gizo a wannan sabar ba tukuna. Ziyarci ofishin rajista domin neman PIN da kanka.",
  },
  "resultPin.step1.title": { en: "Step 1 · Enter your details", ha: "Mataki 1 · Shigar da Bayananka" },
  "resultPin.step1.label": { en: "Student / Admission Number", ha: "Lambar Ɗalibi / Shiga Makaranta" },
  "resultPin.step1.verify": { en: "Verify Student", ha: "Tabbatar da Ɗalibi" },
  "resultPin.step2.changeNumber": { en: "Change student number", ha: "Canza Lambar Ɗalibi" },
  "resultPin.step2.title": { en: "Step 2 · Confirm & select result period", ha: "Mataki 2 · Tabbatar da Zaɓi Lokacin Sakamako" },
  "resultPin.step2.verified": { en: "Student verified", ha: "An Tabbatar da Ɗalibi" },
  "resultPin.step2.name": { en: "Name", ha: "Suna" },
  "resultPin.step2.studentId": { en: "Student ID", ha: "Lambar Ɗalibi" },
  "resultPin.step2.programme": { en: "Programme", ha: "Shiri" },
  "resultPin.step2.class": { en: "Class", ha: "Aji" },
  "resultPin.step2.schoolSection": { en: "School/Section", ha: "Makaranta/Sashe" },
  "resultPin.step2.academicSession": { en: "Academic Session", ha: "Zangon Karatu" },
  "resultPin.step2.selectSession": { en: "Select session", ha: "Zaɓi Zango" },
  "resultPin.step2.term": { en: "Term", ha: "Lokaci" },
  "resultPin.step2.selectSemester": { en: "Select term", ha: "Zaɓi Lokaci" },
  "resultPin.step2.firstTerm": { en: "First Term", ha: "Lokaci na Farko" },
  "resultPin.step2.secondTerm": { en: "Second Term", ha: "Lokaci na Biyu" },
  "resultPin.step2.pinLabel": { en: "Result Checking PIN", ha: "PIN na Duba Sakamako" },
  "resultPin.step2.proceedToPayment": { en: "Proceed to Payment", ha: "Ci Gaba zuwa Biyan Kuɗi" },
  "resultPin.step2.securePayment": { en: "Payments are processed securely via Paystack.", ha: "Ana sarrafa biyan kuɗi cikin aminci ta hanyar Paystack." },
  "resultPin.alreadyHavePin": { en: "Already have a PIN?", ha: "Kana da PIN tuni?" },
  "resultPin.checkYourResult": { en: "Check your result", ha: "Duba Sakamakonka" },
  "resultPin.selectSessionSemesterError": { en: "Select the academic session and semester.", ha: "Zaɓi zangon karatu da lokaci." },

  // Result PIN callback
  "resultPin.callback.confirming": { en: "Confirming your payment…", ha: "Ana Tabbatar da Biyan Kuɗinka…" },
  "resultPin.callback.pleaseWait": { en: "Please don't close this page. This only takes a moment.", ha: "Da fatan kada ka rufe wannan shafi. Ɗan lokaci kaɗan zai ɗauka." },
  "resultPin.callback.success.title": { en: "Payment Successful", ha: "An Yi Nasarar Biyan Kuɗi" },
  "resultPin.callback.success.body": { en: "Your Result PIN Voucher is ready.", ha: "Takardar PIN na Sakamakonka a shirye take." },
  "resultPin.callback.downloadVoucher": { en: "Download PIN Voucher", ha: "Sauke Takardar PIN" },
  "resultPin.callback.linkFailed": {
    en: "Your PIN was saved, but the download link couldn't be generated right now. Visit",
    ha: "An ajiye PIN ɗinka, amma ba a iya samar da hanyar saukewa a yanzu ba. Ziyarci",
  },
  "resultPin.callback.toTryAgain": { en: "to try again.", ha: "domin sake gwadawa." },
  "resultPin.callback.checkResult": { en: "Check Result", ha: "Duba Sakamako" },
  "resultPin.callback.returnToSite": { en: "Return to school website", ha: "Koma zuwa Shafin Makaranta" },
  "resultPin.callback.error.title": { en: "Payment Could Not Be Confirmed", ha: "Ba a Tabbatar da Biyan Kuɗi Ba" },
  "resultPin.callback.tryAgain": { en: "Try Again", ha: "Sake Gwadawa" },
  "resultPin.callback.noReference": { en: "No payment reference was supplied.", ha: "Ba a bayar da lambar nuni ta biyan kuɗi ba." },

  // Verify result
  "verifyResult.checking": { en: "Checking document…", ha: "Ana Duba Takardar…" },
  "verifyResult.verified.title": { en: "Document Verified", ha: "An Tabbatar da Takardar" },
  "verifyResult.verified.body": { en: "This is a genuine result report card issued by this institution.", ha: "Wannan sahihin rahoton sakamako ne wanda wannan makarantar ta bayar." },
  "verifyResult.verificationNo": { en: "Verification No.", ha: "Lambar Tabbatarwa" },
  "verifyResult.studentName": { en: "Student Name", ha: "Sunan Ɗalibi" },
  "verifyResult.programme": { en: "Programme", ha: "Shiri" },
  "verifyResult.session": { en: "Session", ha: "Zango" },
  "verifyResult.term": { en: "Term", ha: "Lokaci" },
  "verifyResult.issued": { en: "Issued", ha: "An Bayar" },
  "verifyResult.privacyNote": { en: "Scores and grades are not shown here for the student's privacy.", ha: "Ba a nuna maki da darajoji a nan don kare sirrin ɗalibi." },
  "verifyResult.notRecognized.title": { en: "Not a Recognized Document", ha: "Ba Takarda Da Aka Sani Ba" },
  "verifyResult.notRecognized.body": {
    en: "This verification code doesn't match any result report card issued by this institution.",
    ha: "Wannan lambar tabbatarwa ba ta dace da wani rahoton sakamako da wannan makarantar ta bayar ba.",
  },
} as const;

export type DictKey = keyof typeof DICT;

const HA_MONTHS = ["Janairu", "Fabrairu", "Maris", "Afrilu", "Mayu", "Yuni", "Yuli", "Agusta", "Satumba", "Oktoba", "Nuwamba", "Disamba"];

/** A calendar date written the way the visitor's chosen language writes it (Hausa: "12 ga Oktoba, 2026"). */
export function formatLocalizedDate(value: string | Date | null | undefined, lang: Lang): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  if (lang === "ha") return `${d.getDate()} ga ${HA_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function useT() {
  const { lang } = useLanguage();
  return (key: DictKey) => {
    const entry = DICT[key] as Record<Lang, string> | undefined;
    return entry?.[lang] ?? entry?.en ?? key;
  };
}
