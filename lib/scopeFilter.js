// lib/scopeFilter.js
// Scope Filter: Restricts CRM data strictly to Zergware and MultiDomain Systems software pipeline.
// Filters out personal emails, NYU/academic classes, mentor chats, student clubs (L'SPACE, Clio, Tartinery),
// career/resume coaching, vendor pitches, and automated replies (unless a human replied in the thread).

export const COMPANY_DOMAINS = ['zergware.com', 'multidomainsys.com'];
export const COMPANY_NAMES = ['zergware', 'multidomain systems', 'multidomain', 'dms'];

// Internal team / personal accounts of Sujay and co-founders
export const INTERNAL_ACCOUNTS = new Set([
  'sss9869@nyu.edu',
  'sujay9sundar@gmail.com',
  'sgoodman71120@gmail.com',
  'sg7882@nyu.edu',
  'lincoln@zergware.com',
  'richwelsh@zergware.com',
  'richwelsh@gmail.com',
  'pthornton718@gmail.com',
  'dearyakov@gmail.com',
  'aziz.a.a.gh@gmail.com',
]);

// Explicit non-software contacts (mentors, career chats, NYU classes/advisors, student clubs, family, vendor spam)
export const EXCLUDED_CONTACT_IDS = new Set([
  // Family / Personal
  'c_01fa4dbe72', // jayalakshmi_sundar@yahoo.com (Jaya Sundar - NYU extension / Wasserman paystub)
  // Internal team / Co-founders
  'c_5b53fddf86', // sss9869@nyu.edu (Sujay)
  'c_70ad9227ec', // sg7882@nyu.edu (Samuel Goodman)
  'c_e1f7d53bf4', // sgoodman71120@gmail.com (Samuel Goodman)
  'c_a2597090a7', // lincoln@zergware.com
  'c_9eb7c69e2c', // richwelsh@zergware.com
  'c_cc143b29e0', // richwelsh@gmail.com
  'c_bc60b3205a', // pthornton718@gmail.com (Patrick Thornton)
  'c_0985830e1c', // dearyakov@gmail.com (Yakov)
  'c_c37fd2c8a3', // aziz.a.a.gh@gmail.com (Aziz)
  // Mentors, Career Conversations, Resume Reviews & Startup Coaching
  'c_e6a9dfc3e1', // shroodbi@gmail.com (Mentor Conversation w/ Kartik S.)
  'c_bb27db7af8', // kshastri@outlook.com (Conversation w/ Kartik Shastri)
  'c_deb70ee81f', // romanspersonalemail@gmail.com (Sujay & Roman Career Conversation / resume review)
  'c_b2fc751fd7', // roman.desantos@neros.tech (Roman De Santos - career chat pointing to romanspersonalemail@gmail.com)
  'c_2055bd61fb', // moksh@corgi.insure (Mentor Conversation w/ Moksh)
  'c_04d3192318', // liam@corgiinsure.com (Corgi Insurance vendor call)
  'c_3e977ddea6', // ajaykrucheniya@gmail.com (Applicant interview)
  'c_8dc7456f1d', // rebai.habib.ben.ali@gmail.com (Applicant interview)
  'c_3e1cdaa35a', // nyu713@nyu.edu (NYUEI Returning Student Startup Coaching)
  'c_fde0233978', // fletcher@scalethesis.com (Fletcher Roberts Meeting)
  'c_780585d0c9', // harsha02@sas.upenn.edu (VC & Fundraising Intros - Harsha)
  'c_0ba8ce83b7', // dario@getpupil.com (Dario Anaya)
  'c_0f1d7b1f8d', // craigfrench8@gmail.com (Conversation w/ Craig)
  'c_5dc9431d25', // gk@globalkeysolutions.net (Conversation w/ George)
  'c_65943620d9', // soul@trueventures.com (Soul's Calendar)
  'c_6e74d260ad', // chinitoboricua@gmail.com (Call w/ Nathan A.)
  'c_7064f45fc3', // mike@perch.app (30 Minute Call)
  'c_918500b722', // m.kubar@pnptc.com (Mathias's appointments)
  'c_93d407368d', // anand@dili.ai (Anand Chaturvedi)
  'c_ba3149dc87', // boardy@boardy.ai (Call with Boardy)
  'c_e4b79adfc1', // chris@futureoptions.co (Chris Smith)
  // High-school mentees / tutoring calls ("Calls w/ Sujay S.")
  'c_0727bf22e7', // ivanbrv10@gmail.com (Calls w/ Sujay S. - Ivan Bravo)
  'c_be487aa5a1', // ibravo2027@sacredhearths.org (Calls w/ Sujay S. - Ivan Bravo)
  'c_8ccb5e4c44', // ialejandro2027@sacredhearths.org (Calls w/ Sujay S. - Isela Alejandro)
  'c_16e10d8caa', // leo.lam30@epsomcollege.edu.my (Calls w/ Sujay S. - Leo Lam)
  'c_9238c44919', // leolam.30@epsomcollege.edu.my (Calls w/ Sujay S. - Leo Lam)
  // Vendor sales pitches / bookkeeping / perks / bots
  'c_f7cc4aa366', // anya.popenoe@pilot.com (Pilot bookkeeping overview & newsletter)
  'c_fc9aa09861', // nitish@f6s.com (F6S Concierge / AWS credits chat)
  'c_2a86e5ca67', // softwareconcierge@f6s.com (F6S Concierge)
  'c_63e5c78f8d', // george@diagrm.com
  'c_833ae1b2f1', // javier@diagrm.com
  'c_90bf8133d7', // mberelowitz@brex.com (Brex Virtual Connect)
  'c_1d2cb134df', // tony.b@miro.com (Miro)
  'c_1795e97da3', // meet-assistant@runable.computer (Meeting bot)
  // NYU Classes, Office Hours, Advisors, Campus Clubs
  'c_3718f1ab13', // msc398@nyu.edu (Design Project I Meeting w/ Prof. Campisi)
  'c_fb8e0840db', // hg2918@nyu.edu (Office Hours w/ Hakan / Midterm Retake)
  'c_92ffe48fee', // cm6734@nyu.edu (Sujay x Celestino Problem-Solving Practice)
  'c_c622702357', // rse4420@stern.nyu.edu (Kimmel Center / GenReach Onboarding)
  'c_ede2eb2a54', // jcc23@nyu.edu (Jen Curtis Intern interview / Leslie eLab)
  'c_1eeb7715ba', // afr7655@nyu.edu (NYU Appointment)
  'c_fb83b2d81e', // manan.modi.nyc@gmail.com (Tribeca Club Interview)
  // Other Student Projects: NASA L'SPACE / MCA SU26
  'c_20190a7fb8', // garciaic49@gmail.com (MCA SU26)
  'c_274389209e', // sgonzales.eng@gmail.com (MCA SU26)
  'c_28475038d9', // drios3367@gmail.com (MCA SU26)
  'c_337e8372be', // m05lanina@gmail.com (MCA SU26)
  'c_3cbcac45e6', // nathanmeek2005@gmail.com (MCA SU26)
  'c_a392464dc5', // hacen.maloum@gmail.com (MCA SU26)
  'c_b7058076e7', // larissadass79@gmail.com (MCA SU26 / L'SPACE)
  'c_bae0ce885e', // ammurphy102@gmail.com (L'SPACE Team 12)
  // Other Student Projects: Clio / Tartinery
  'c_0529aafb78', // mgradelski@gmail.com (Clio / Tartinery)
  'c_427d9987d9', // nancylu09@gmail.com (Clio / Tartinery)
  'c_4f7847b536', // yang.h@nyu.edu (Clio / Tartinery)
  'c_820a22cf82', // ashley.n.gonsalves@gmail.com (Clio)
  'c_c0e4282d53', // mia.gradelski@gmail.com (Clio)
]);

export const EXCLUDED_EMAIL_PATTERNS = [
  /@sacredhearths\.org$/i,
  /@epsomcollege\.edu\.my$/i,
  /@stern\.nyu\.edu$/i,
  /jayalakshmi/i,
  /\+noreply@/i,
  /\+canned\.response@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^meet-assistant@/i,
  /^softwareconcierge@f6s\.com$/i,
  /^anya\.popenoe@pilot\.com$/i,
  /^romanspersonalemail@gmail\.com$/i,
  /^roman\.desantos@neros\.tech$/i,
  /^shroodbi@gmail\.com$/i,
  /^kshastri@outlook\.com$/i,
];

const EXCLUDED_KEYWORDS = [
  // Academic & Student Classes (Note: never exclude 'flight' or '.edu' UAS labs!)
  'homework',
  'syllabus',
  'coursework',
  'classmates',
  'office hours',
  'practice midterm',
  'midterm retake',
  'tuition',
  'dorm',
  'intern interview',
  'leslie elab',
  'kimmel center',
  'genreach',
  'tribeca club',
  'problem-solving practice',
  'design project i',

  // Mentorship & Career Coaching (not commercial software pipeline)
  'mentor conversation',
  'mentorship',
  'mentoring',
  'career conversation',
  'career advice',
  'career coach',
  'startup coaching',
  'returning student startup coaching',
  'first-time coaching appointment',
  'tutoring',

  // Other Student / Unrelated Projects
  'clio team',
  'clio general',
  'tartinery',
  'mca su26',
  "l'space",
  'ship alpha user test',

  // Personal / Consumer Noise
  'roommate',
  'landlord',
  'sublease',
  'dentist',
  'prescription',
  'pharmacy',
  'doordash',
  'wasserman',
  'paystub',
];

const AUTO_REPLY_SUBJECT_RX = /^(automatic reply|auto-?reply|autoresponse|out of office|undeliverable|delivery status notification|mail delivery failed)/i;

// Name enrichments for contacts whose display name was null in raw DB but present in email signatures / meeting titles
export const CONTACT_NAME_ENRICHMENTS = {
  c_c63bc6d3ae: 'Jon',                 // jonb@ledauas.org (LEDA UAS - signed "Thanks, Jon")
  c_5177ab746a: 'Nathan Beebe',        // nathanbeebe@dragonflyaerialsolutions.net (Dragonfly Aerial Solutions)
  c_de604eddea: 'Matthew C. Kemelek',  // matthew.c.kemelek.mil@army.mil (US Army)
  c_053f63d80e: 'Ryan S. DeBooy',      // ryan.s.debooy.mil@army.mil (US Army 25th ID)
  c_8609cf4df5: 'Justice L. Castillo', // justice.l.castillo.mil@army.mil (US Army V Corps)
  c_ad00ee31bc: 'Kenneth',             // hello@aeriusview.com (AeriusView)
  c_a4a9c7bdd1: 'John',                // sales@dronedesk.io (DroneDesk)
  c_d551284525: 'Spatial Wings Team',  // info@spatialwings.com (Spatial Wings)
  c_678fa881ce: 'AZDOT Aeronautics',   // aeronautics@azdot.gov (Arizona DOT Aeronautics)
  c_beeb01da80: 'Osage Nation Drone Team', // scholarship@osagenation-nsn.gov
  c_dad156069c: 'US Army PEO Aviation', // usarmy.redstone.mbx.cpeavn-pao@army.mil
  c_0f7a52a1a5: 'Nadiia Khomaziuk',    // nkhomaziuk@usubc.org (US-Ukraine Business Council)
  c_4953ea1c4c: 'Gene',                // odoo@fruitychutes.com (Fruity Chutes)
  c_0228172902: 'Kevin Padilla',       // kpadilla@flyaerovis.com
  c_02335ad6bb: 'Ryan Falcone',        // rmfalcone79@gmail.com
  c_0445c548b7: 'Charles',             // cch@renegadeuxs.com
  c_04d3192318: 'Liam',                // liam@corgiinsure.com
  c_0828a36668: 'Jerimiah Contreras',  // jcontreras@flyguys.com
  c_0cc21fbddf: 'Mark Bliss (Detroit PD)', // sawmillerg977@detroitmi.gov
  c_0f39500fb3: 'Ahmed',               // al_rasim@hotmail.com
  c_0ff4738d62: 'Robert Shaw',         // robzshawz@gmail.com
  c_1398dfdf9a: 'Ahmed (AIS UAV)',     // drospec@outlook.com
  c_207324d16c: 'Matthew Morrissey',   // morrisseyaviation@gmail.com
  c_2d1487aba7: 'Javier Sanchez',      // javiersanchez.ar99@gmail.com
  c_2d6883459b: 'Abhishek Nagtilak',   // abhishek.nagtilak@aureuswc.com
  c_2e7bb93cd2: 'Danish',              // dp3858@nyu.edu
  c_3b37cce162: "Jason D'Richards",    // jason.drichards@skydio.com
  c_3cd22b7f50: 'Josh',                // decks@deepchecks.vc
  c_3e977ddea6: 'Ajay Ucheniya',       // ajaykrucheniya@gmail.com
  c_3f4fd6c058: 'Murat Arcak',         // arcak@berkeley.edu
  c_43f8f32804: 'Warren',              // warren@voltairlabs.com
  c_4e75eb5462: 'Jeff Herrmann',       // jeff_herrmann@comcast.net
  c_5aacfffb1f: 'Robert Dodgen',       // robert.dodgen@bia.gov
  c_5d9bf3e70f: 'Steve Beier',         // steve@stevebeier.com
  c_5e5e65890e: 'Brian M.',            // brianmcsarasota@gmail.com
  c_5fe8cbce67: 'Darin Whiteside',     // drnvns31@icloud.com
  c_6152c12986: 'Arief Azis',          // ariefazis@aol.com
  c_66abcf29a5: 'Michael Leo',         // michael.leo@fdny.nyc.gov
  c_693d190f3e: "Jason D'Richards",    // jasmid@protonmail.com
  c_6d75c23cca: 'Chris Stiles',        // cstiles.ng@gmail.com
  c_827b3021f0: 'Jon',                 // jon@muckercapital.com
  c_84a0847fc7: 'Geoffrey Gaskin',     // geoffrey.gaskin@atl.com
  c_8dc7456f1d: 'Habib Rebai',         // rebai.habib.ben.ali@gmail.com
  c_8ff12fe5ae: 'Divyank Gupta',       // gdivyankgupta@gmail.com
  c_90ee4e4960: 'Sam McKay',           // sammckay2243@gmail.com
  c_91aa124484: 'Jan',                 // rem.pilotjan@gmail.com
  c_992c674f10: 'Viswanatha Sharma',   // vvsharma1310@gmail.com
  c_99a3cb4388: 'Mike Milioto',        // mmilioto83@gmail.com
  c_9b6527f9fb: 'Josh Percolla',       // jpercolla@gmail.com
  c_a68eab31c2: 'Alex Skalov',         // alex.skalov@gmail.com
  c_acbff61f30: 'Ahmed',               // sales@ppis-me.com
  c_ae43e3f475: 'Eric Legler',         // eric.legler@icloud.com
  c_b00dd3427e: 'Kotopetsa',           // kotopetsa@gmail.com
  c_b85c6e8cc1: 'Ella Atkins',         // ematkins@vt.edu
  c_ba0bcb417f: 'Adrian Pueyo',        // adrianp@apollodroneservices.com
  c_bf49785b0a: 'Bobby Ouyang',        // bobby@skyebrowse.com
  c_c14ef28b48: 'Erik',                // erik@muckercapital.com
  c_c5f5724e21: 'Parth',               // parth@array.vc
  c_c74b839c62: 'Rayvon Williams',     // rayvon.williams@watsonville.gov
  c_c919760a64: 'Houston Lear',        // hlear86@gmail.com
  c_ce1d1c96d4: 'Omar Omoosh',         // omar.omoosh@gmail.com
  c_d03075d91d: 'Vigneshwar Parameshwar', // v.parameshwar121@gmail.com
  c_d1e6cad1e8: 'Mike Milioto',        // mmilioto@skyhawksurveysolutions.com
  c_d54d6fb0dd: 'David Neef',          // david.neef@dot.ohio.gov
  c_d6debf3f21: 'Tim Viles',           // tim.viles@theari.us
  c_d7b2893cb9: 'Paul Hubbard',        // paul.hubbard@fpl.com
  c_d89610ad49: 'Benjamin Griffith',   // blgriffith32@gmail.com
  c_de12b85ba4: 'Wayne Bailey',        // wayne.bailey@blueridgemountaindrones.com
  c_dfb2aeb534: 'Joshua Cagle',        // joshcagle001@gmail.com
  c_ea60aa48b3: 'Sam McKay',           // sammckay2243@outlook.com
  c_ed1ead13bf: 'Odest Chadwicke Jenkins', // ocj@umich.edu
  c_ee387cdbe4: 'Darin Whiteside',     // darin.i.whiteside.mil@usmc.mil
  c_f1b54b67ab: 'Ahmed',               // rd@aisuav.com.sa
  c_f2d0d1387d: 'Jason Cabral',        // jasonandrewcabral@gmail.com
  c_fc7c8c9069: 'Daniel Breda',        // daniel.breda@dot.ohio.gov
  c_fdf077c63b: 'Scott Scileppi',      // gscileppi@redmond.gov
};

export const CONTACT_ORG_ENRICHMENTS = {
  c_0228172902: 'FlyAerovis',
  c_02335ad6bb: 'FlyAerovis',
  c_0445c548b7: 'Renegade UXS',
  c_04d3192318: 'Corgi Insurance',
  c_055cd9453e: 'ScoutDI',
  c_0cc21fbddf: 'Detroit Police Department',
  c_0f39500fb3: 'Air Information Solutions UAV',
  c_1398dfdf9a: 'Air Information Solutions UAV',
  c_207324d16c: 'Morrissey Aviation',
  c_2125c4ab42: 'University of Kentucky Police Dept',
  c_2d6883459b: 'Aureus',
  c_3b37cce162: 'Skydio',
  c_3cd22b7f50: 'Deep Checks VC',
  c_3f4fd6c058: 'UC Berkeley',
  c_40dc3d218e: 'University of Kentucky',
  c_43f8f32804: 'VoltAir Labs',
  c_4e75eb5462: 'Newtowne Partners',
  c_5d9bf3e70f: 'Steve Beier Consulting',
  c_5fe8cbce67: 'US Marine Corps (USMC)',
  c_66abcf29a5: 'FDNY',
  c_693d190f3e: 'Skydio',
  c_6a72e57115: 'Array VC',
  c_827b3021f0: 'Mucker Capital',
  c_84a0847fc7: 'Hartsfield-Jackson Atlanta International Airport',
  c_8aaa8108a7: 'Hogan Lovells',
  c_8ff12fe5ae: 'Aureus',
  c_99a3cb4388: 'Skyhawk Survey Solutions',
  c_9b6527f9fb: 'Deep Checks VC',
  c_acbff61f30: 'PPIS',
  c_b85c6e8cc1: 'Virginia Tech',
  c_ba0bcb417f: 'Apollo Drone Services',
  c_bf49785b0a: 'SkyeBrowse',
  c_c14ef28b48: 'Mucker Capital',
  c_c5f5724e21: 'Array VC',
  c_d1e6cad1e8: 'Skyhawk Survey Solutions',
  c_d54d6fb0dd: 'Ohio DOT UAS Center',
  c_d7b2893cb9: 'Florida Power & Light (FPL)',
  c_de12b85ba4: 'Blue Ridge Mountain Drones',
  c_ed1ead13bf: 'University of Michigan',
  c_ee387cdbe4: 'US Marine Corps (USMC)',
  c_fc7c8c9069: 'Ohio DOT UAS Center',
  c_fdf077c63b: 'City of Redmond Drone Program',
};

export function isInternalAccount(email) {
  if (!email) return false;
  return INTERNAL_ACCOUNTS.has(email.toLowerCase().trim());
}

export function isAutoReplyMessage(m) {
  if (!m) return false;
  if (m.kind === 'auto_reply') return true;
  if (m.ooo_type) return true;
  const subj = (m.subject || '').trim();
  if (AUTO_REPLY_SUBJECT_RX.test(subj)) return true;
  const fromAddr = (m.from_addr || '').toLowerCase();
  if (/\+noreply@|\+canned\.response@|^noreply@|^no-reply@|^mailer-daemon@/i.test(fromAddr)) return true;
  const body = (m.snippet || m.body || '').trim();
  if (/^(thank you for contacting|i am currently out of the office|i am out of the office|this is an automated response)/i.test(body) && m.direction === 'in' && m.kind !== 'reply') {
    return true;
  }
  return false;
}

export function isExcludedContact(c, { hasDeal = true, hasHumanReply = false, allowAutoReply = false } = {}) {
  if (!c) return true;
  if (EXCLUDED_CONTACT_IDS.has(c.id)) return true;

  const email = (c.email || '').toLowerCase().trim();
  if (isInternalAccount(email)) return true;

  for (const pat of EXCLUDED_EMAIL_PATTERNS) {
    if (pat.test(email)) return true;
  }

  // Filter out pure auto-reply contacts UNLESS an actual human responded in that thread (or when indexing the Automatic Reply tab)
  if (!allowAutoReply && c.source === 'auto_reply' && !hasHumanReply) {
    return true;
  }

  // Calendar-sourced contacts without a deal in Supabase are personal/academic/club calendar invitees
  if (c.source === 'calendar' && !hasDeal && !hasHumanReply) {
    return true;
  }

  // Exclude @nyu.edu contacts unless explicitly a MultiDomain customer interview (c_2e7bb93cd2)
  if (email.endsWith('@nyu.edu') && c.id !== 'c_2e7bb93cd2') {
    return true;
  }

  const textToCheck = [
    c.name,
    c.org,
    c.reply_note,
    c.next_action,
  ].filter(Boolean).join(' ').toLowerCase();

  return EXCLUDED_KEYWORDS.some(kw => textToCheck.includes(kw));
}

export function isExcludedMessage(m, contact) {
  if (!m) return true;
  if (contact && isExcludedContact(contact)) return true;

  // Exclude automated replies from the email lists / feed (human replies in the same thread have m.kind === 'reply' and are kept!)
  if (isAutoReplyMessage(m)) return true;

  const subject = (m.subject || '').toLowerCase();
  const snippet = (m.snippet || '').toLowerCase();
  const text = subject + ' ' + snippet;

  // Exclude mentor, resume, academic, or personal emails
  if (/mentor|career conversation|resume|midterm|office hours|pilot\.com|clio|tartinery|l'space|mca su26|calls w\/ sujay/i.test(text)) {
    return true;
  }

  return EXCLUDED_KEYWORDS.some(kw => text.includes(kw));
}

export function isExcludedMeeting(meet, contactMap) {
  if (!meet) return true;

  const title = (meet.title || '').toLowerCase();
  const desc = (meet.description || '').toLowerCase();
  const text = title + ' ' + desc;

  // 1. Explicitly exclude mentor conversations, career chats, classes, student clubs, personal errands, and generic NYC event placeholders
  if (
    /mentor|career conversation|calls w\/ sujay|leo lam|ivan bravo|isela alejandro|kartik|fletcher roberts|intern interview|leslie elab|kimmel center|genreach|tribeca club|office hours|prof\. campisi|design project|problem-solving practice|celestino|clio|tartinery|mca su26|l'space|team 12|ship alpha|team catch up|sujay check-in|sujay < > nancy|call nyu|wasserman|paystub|startup coaching|f6s concierge|aws \$5k|pilot overview|boardy|virtual connect.*brex|soul's calendar|mathias's appointments|30 minute call \(sujay|completed appointment with sujay|vc & fundraising intros|sujay sundar and (dario|anand|chris|javier)|sujay \/ tony|conversation w\/ (craig|george|sam and elizabeth)/i.test(text)
  ) {
    return true;
  }

  // Exclude generic recurring NYC tech meetup calendar placeholders that aren't client meetings
  if (/\(recurring – verify date\)|\(occasional – verify date\)|\[dates tbc\]|\[date approx\]/i.test(title)) {
    return true;
  }

  // Exclude generic NYU / career discovery workshops
  if (/^discovery:|nyu entrepreneurs|international summer research|virtual: startup accelerator/i.test(title)) {
    return true;
  }

  // 2. Check excluded keywords
  if (EXCLUDED_KEYWORDS.some(kw => text.includes(kw))) {
    return true;
  }

  // 3. Must be linked to at least one valid external software lead
  const hasCompanyContact = (meet.contact_ids || []).some(id => {
    const c = contactMap?.[id];
    return c && !isExcludedContact(c) && !isInternalAccount(c.email);
  });

  if (hasCompanyContact) {
    return false;
  }

  return true;
}

export function isExcludedNotification(n, validContactIds) {
  if (!n) return true;
  if (n.contact_id && !validContactIds.has(n.contact_id)) return true;
  const text = ((n.title || '') + ' ' + (n.body || '')).toLowerCase();
  if (/mentor|kartik|roman|leo lam|ivan bravo|isela|midterm|hakan|pilot|f6s|clio|tartinery|l'space|mca su26|nyu|wasserman|automatic reply|auto-reply|out of office/i.test(text)) {
    return true;
  }
  return false;
}
