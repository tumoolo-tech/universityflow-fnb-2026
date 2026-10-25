// Builds the UniversityFlow pitch deck: ../UniversityFlow_FNB_Hackathon_2026.pptx
// Layout system and slide types from the owner's Y'elloLoop deck (MTN hackathon 2026), re-skinned
// in UniversityFlow's brand: the dark theme, the dusty mauve accent and Outfit (packages/tokens,
// docs/design/README.md). The motif is the journey path: a dashed line from Grade 10 to graduation.
// Every number on a slide is from the sources slide and pitch/README.md; the costs slide's are labelled estimates.
// Run (see pitch/README.md): node pitch/scripts/build_deck.js
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa6');

const SKILL =
  process.env.PPTX_SKILL_DIR ||
  path.join(
    process.env.USERPROFILE || '',
    '.claude/skills/synced/a67704ac-f85d-4ef1-9d85-d19ee50523b8_283b5e52-281c-4969-a239-79cfad1bd816/pptx',
  );
const { applyTheme } = require(path.join(SKILL, 'scripts', 'apply_theme.js'));

const PITCH = path.join(__dirname, '..');
const OUT = path.join(PITCH, 'UniversityFlow_FNB_Hackathon_2026.pptx');
const img = (f) => path.join(PITCH, 'images', f);
const chart = (f) => path.join(PITCH, 'charts', f);

// ---------- Theme (packages/tokens) ----------
const HEX = {
  canvas: '0E0D10',
  surface: '17161A',
  sunk: '211F25',
  ink: 'F4F2F5',
  body: 'E2DEE4',
  muted: 'B9B4BC',
  line: '2E2C32',
  lineStrong: '78727D',
  brand: 'C99BB8',
  accent: 'E9B8D4',
  onBrand: '1A1219',
  onBrandSoft: '3A2B35',
  success: '4ADE80',
  warning: 'F5C26B',
  danger: 'FF8A80',
  stageBottom: '433F45',
};
const THEME = {
  name: 'UniversityFlow',
  headFontFace: 'Outfit',
  bodyFontFace: 'Outfit',
  colors: {
    dk1: HEX.canvas,
    lt1: HEX.ink,
    dk2: HEX.surface,
    lt2: HEX.body,
    accent1: HEX.brand,
    accent2: HEX.accent,
    accent3: HEX.muted,
    accent4: HEX.sunk,
    accent5: HEX.success,
    accent6: HEX.danger,
    hlink: HEX.accent,
    folHlink: HEX.brand,
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.title = 'UniversityFlow: FNB Hackathon 2026';
pres.author = 'Tumo Mogame, Tumoolo';
pres.company = 'Tumoolo';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const K = {
  canvas: C.text1,
  surface: C.text2,
  ink: C.background1,
  body: C.background2,
  brand: C.accent1,
  accent: C.accent2,
  muted: C.accent3,
  sunk: C.accent4,
  success: C.accent5,
  danger: C.accent6,
  onBrand: HEX.onBrand,
  onBrandSoft: HEX.onBrandSoft,
  warning: HEX.warning,
};
const SW = 13.333,
  SH = 7.5,
  PW = 4.6;

async function icon(name, hex, size = 256) {
  const El = fa[name];
  if (!El) throw new Error(`No icon ${name}`);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(El, { color: '#' + hex, size }),
  );
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

// ---------- Layouts ----------
const FOOT = 'UniversityFlow  ·  Tumo Mogame, Tumoolo  ·  FNB Hackathon 2026';
function layout(title, { mauve, x = 0.6, w = 12.1, footX = 0.6, numX = 12.2, glow = false }) {
  const ink = mauve ? K.onBrand : K.ink;
  const sub = mauve ? K.onBrandSoft : K.muted;
  const objects = [];
  if (glow) objects.push({ image: { path: img('glow.png'), x: 7.3, y: 0, w: 6.033, h: 4.34 } });
  objects.push(
    {
      placeholder: {
        options: {
          name: 'kicker',
          type: 'body',
          x,
          y: 0.35,
          w: Math.min(w, 7),
          h: 0.35,
          fontSize: 12,
          bold: true,
          color: mauve ? K.onBrand : K.brand,
          charSpacing: 3,
          margin: 0,
          valign: 'middle',
        },
        text: '',
      },
    },
    {
      placeholder: {
        options: {
          name: 'title',
          type: 'title',
          x,
          y: 0.72,
          w,
          h: 0.95,
          fontFace: 'Outfit',
          fontSize: 32,
          bold: true,
          color: ink,
          margin: 0,
          valign: 'top',
          align: 'left',
        },
        text: '',
      },
    },
    {
      text: {
        text: FOOT,
        options: { x: footX, y: 7.0, w: 7.2, h: 0.3, fontSize: 10, color: sub, margin: 0 },
      },
    },
  );
  pres.defineSlideMaster({
    title,
    background: { color: mauve ? HEX.brand : HEX.canvas },
    objects,
    slideNumber: { x: numX, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: sub, align: 'right' },
  });
}
pres.defineSlideMaster({ title: 'COVER', background: { color: HEX.canvas }, objects: [] });
layout('DARK', { mauve: false, glow: true });
layout('DARK_PANEL_R', { mauve: false, w: 7.6, numX: 7.7 });
layout('MAUVE', { mauve: true });
layout('MAUVE_PANEL_L', { mauve: true, x: PW + 0.6, w: SW - PW - 1.2, footX: PW + 0.6 });
layout('MAUVE_PANEL_R', { mauve: true, w: 7.6, numX: 7.7 });

const sections = {};
let count = 0;
let kickerNo = 0;
// A kicker starting with '##' gets the next number ('##  ·  ROADMAP' -> '##  ·  ROADMAP')
function slide(layoutName, section, kicker, title) {
  if (!sections[section]) {
    pres.addSection({ title: section });
    sections[section] = true;
  }
  const s = pres.addSlide({ masterName: layoutName, sectionTitle: section });
  if (kicker && kicker.startsWith('##'))
    kicker = String(++kickerNo).padStart(2, '0') + kicker.slice(2);
  if (kicker) s.addText(kicker, { placeholder: 'kicker' });
  if (title) s.addText(title, { placeholder: 'title' });
  count++;
  return s;
}
const T = (s, text, o) =>
  s.addText(
    text,
    Object.assign(
      {
        isTextBox: true,
        margin: 0,
        fontSize: 16,
        color: K.body,
        valign: 'top',
        fontFace: 'Outfit',
      },
      o,
    ),
  );
function card(s, x, y, w, h, fill, name, line) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: 0.12,
    fill: fill ? { color: fill } : { type: 'none' },
    line: { color: line || fill, width: line ? 1.5 : 0 },
    objectName: name,
  });
}
function panel(s, file, side, alt) {
  const x = side === 'left' ? 0 : SW - PW;
  s.addImage({
    path: img(file),
    x,
    y: 0,
    w: PW,
    h: SH,
    sizing: { type: 'cover', w: PW, h: SH },
    altText: alt,
  });
}
function source(s, text, x = 0.6, w = 12.1, color = K.muted) {
  T(s, text, { x, y: 6.5, w, h: 0.4, fontSize: 10, color, italic: true, valign: 'bottom' });
}
// The journey path: a dashed line, the deck's motif (Y'elloLoop's road line, in mauve)
function pathLine(s, x1, x2, y, color, dash = 0.32, gap = 0.2, th = 0.06) {
  for (let x = x1; x < x2 - 0.01; x += dash + gap) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y: y - th / 2,
      w: Math.min(dash, x2 - x),
      h: th,
      rectRadius: th / 2,
      fill: { color },
      line: { color },
    });
  }
}
const STAGES = ['SCHOOL', 'APPLY', 'MATRIC', 'ARRIVE', 'UNIVERSITY'];
function stageTrack(s, active, mauve, x0 = 7.65, x1 = 12.2) {
  const y = 0.3,
    base = mauve ? K.onBrandSoft : K.muted,
    hot = mauve ? K.onBrand : K.brand;
  pathLine(s, x0, x1, y, mauve ? K.onBrandSoft : K.sunk, 0.14, 0.1, 0.035);
  const step = (x1 - x0) / (STAGES.length - 1);
  STAGES.forEach((st, i) => {
    const cx = x0 + i * step,
      on = active.includes(st);
    s.addShape(pres.shapes.OVAL, {
      x: cx - 0.1,
      y: y - 0.1,
      w: 0.2,
      h: 0.2,
      fill: on ? { color: hot } : { color: mauve ? HEX.brand : HEX.canvas },
      line: { color: on ? hot : base, width: 1.25 },
    });
    T(s, st, {
      x: cx - 0.65,
      y: y + 0.16,
      w: 1.3,
      h: 0.25,
      fontSize: 10,
      bold: on,
      color: on ? hot : base,
      align: 'center',
    });
  });
}
// Built / next / partner chips: honest status on every feature
const CHIP = {
  built: { t: 'BUILT', fill: '12301F', color: HEX.success },
  standin: { t: 'BUILT ON STAND-INS', fill: '12301F', color: HEX.success },
  switch: { t: 'BUILT, SWITCHED OFF', fill: '2A2416', color: HEX.warning },
  next: { t: 'NEXT: PROPOSED', fill: '2A2416', color: HEX.warning },
  partner: { t: 'NEEDS A PARTNER', fill: '2E1724', color: HEX.accent },
};
function chip(s, x, y, kind) {
  const c = CHIP[kind];
  const w = 0.3 + c.t.length * 0.085;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h: 0.26,
    rectRadius: 0.13,
    fill: { color: c.fill },
    line: { color: c.fill },
  });
  T(s, c.t, {
    x,
    y,
    w,
    h: 0.26,
    fontSize: 9,
    bold: true,
    color: c.color,
    align: 'center',
    valign: 'middle',
    charSpacing: 1,
  });
  return w;
}
function brandName(size, o = {}) {
  return [
    { text: 'University', options: { color: o.a || K.ink } },
    { text: 'Flow', options: { color: o.b || K.brand } },
  ];
}
// Device frames for real screenshots of the live demo
function phone(s, file, x, y, w, alt) {
  const sw = w - 0.16,
    sh = (sw * 844) / 390;
  const h = sh + 0.42;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    rectRadius: 0.28,
    fill: { color: HEX.canvas },
    line: { color: HEX.stageBottom, width: 2 },
    shadow: { type: 'outer', color: '000000', opacity: 0.4, blur: 14, offset: 5, angle: 90 },
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x + w / 2 - 0.3,
    y: y + 0.09,
    w: 0.6,
    h: 0.08,
    rectRadius: 0.04,
    fill: { color: HEX.stageBottom },
    line: { color: HEX.stageBottom },
  });
  s.addImage({ path: img(file), x: x + 0.08, y: y + 0.25, w: sw, h: sh, altText: alt });
  return h;
}
function laptop(s, file, x, y, w, alt) {
  const sh = (w * 900) / 1440;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x - 0.06,
    y: y - 0.28,
    w: w + 0.12,
    h: sh + 0.34,
    rectRadius: 0.08,
    fill: { color: HEX.sunk },
    line: { color: HEX.stageBottom, width: 1.5 },
    shadow: { type: 'outer', color: '000000', opacity: 0.4, blur: 14, offset: 5, angle: 90 },
  });
  for (const i of [0, 1, 2]) {
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.08 + i * 0.16,
      y: y - 0.19,
      w: 0.1,
      h: 0.1,
      fill: { color: HEX.lineStrong },
      line: { color: HEX.lineStrong },
    });
  }
  s.addImage({ path: img(file), x, y, w, h: sh, altText: alt });
  return sh;
}

(async () => {
  const I = {};
  const need = {
    // on dark
    book: ['FaBookOpen', HEX.brand],
    route: ['FaRoute', HEX.brand],
    scale: ['FaScaleBalanced', HEX.brand],
    clock: ['FaClock', HEX.danger],
    doorC: ['FaDoorClosed', HEX.danger],
    userx: ['FaUserSlash', HEX.danger],
    money: ['FaHandHoldingDollar', HEX.brand],
    grad: ['FaGraduationCap', HEX.brand],
    briefcase: ['FaBriefcase', HEX.brand],
    heart: ['FaHeart', HEX.brand],
    shield: ['FaShieldHalved', HEX.brand],
    flag: ['FaFlag', HEX.brand],
    lock: ['FaLock', HEX.brand],
    phoneB: ['FaMobileScreen', HEX.brand],
    comments: ['FaComments', HEX.brand],
    check: ['FaCircleCheck', HEX.success],
    list: ['FaListCheck', HEX.brand],
    calc: ['FaCalculator', HEX.brand],
    map: ['FaMapLocationDot', HEX.brand],
    bell: ['FaBell', HEX.brand],
    hand: ['FaHandshake', HEX.brand],
    life: ['FaLifeRing', HEX.danger],
    userCheck: ['FaUserCheck', HEX.brand],
    ban: ['FaBan', HEX.brand],
    brain: ['FaBrain', HEX.brand],
    chart: ['FaChartLine', HEX.brand],
    target: ['FaBullseye', HEX.brand],
    rotate: ['FaArrowsRotate', HEX.brand],
    memory: ['FaBookmark', HEX.brand],
    moon: ['FaMoon', HEX.brand],
    coins: ['FaCoins', HEX.brand],
    receipt: ['FaReceipt', HEX.brand],
    rocket: ['FaRocket', HEX.brand],
    // ink on mauve
    schoolK: ['FaSchool', HEX.onBrand],
    penK: ['FaPenToSquare', HEX.onBrand],
    calK: ['FaCalendarCheck', HEX.onBrand],
    campusK: ['FaBuildingColumns', HEX.onBrand],
    gradK: ['FaGraduationCap', HEX.onBrand],
    checkK: ['FaCircleCheck', HEX.onBrand],
    // mauve on dark tiles (mauve slides)
    lockA: ['FaLock', HEX.accent],
    userA: ['FaUserShield', HEX.accent],
    codeA: ['FaCode', HEX.accent],
    banA: ['FaUserLock', HEX.accent],
    eyeA: ['FaEyeSlash', HEX.accent],
    heartA: ['FaHeartPulse', HEX.accent],
    cloudA: ['FaCloudRain', HEX.accent],
    pencilA: ['FaPencil', HEX.accent],
    flagA: ['FaFlagCheckered', HEX.accent],
    homeA: ['FaHouseUser', HEX.accent],
    mapA: ['FaSuitcaseRolling', HEX.accent],
    robotA: ['FaRobot', HEX.accent],
    wifiA: ['FaSignal', HEX.accent],
    smsA: ['FaCommentSms', HEX.accent],
    offlineA: ['FaPlaneUp', HEX.accent],
    voiceA: ['FaVolumeHigh', HEX.accent],
    bookA: ['FaBookOpen', HEX.accent],
    accessA: ['FaUniversalAccess', HEX.accent],
    langA: ['FaLanguage', HEX.accent],
    freeA: ['FaHandHoldingHeart', HEX.accent],
  };
  for (const [k, [nm, c]] of Object.entries(need)) I[k] = await icon(nm, c);

  // ================= 1. COVER =================
  {
    const s = slide('COVER', 'Opening');
    s.addImage({ path: img('glow.png'), x: 7.3, y: 0, w: 6.033, h: 4.34 });
    T(s, 'FNB HACKATHON 2026', {
      x: 0.6,
      y: 0.55,
      w: 7,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: K.brand,
      charSpacing: 3,
    });
    s.addText(brandName(), {
      isTextBox: true,
      x: 0.6,
      y: 0.85,
      w: 9,
      h: 1.15,
      fontFace: 'Outfit',
      fontSize: 66,
      bold: true,
      margin: 0,
      valign: 'top',
    });
    T(s, 'From Grade 10 to graduation.', {
      x: 0.6,
      y: 2.0,
      w: 9,
      h: 0.5,
      fontSize: 26,
      italic: true,
      color: K.ink,
    });
    T(
      s,
      "A companion for South African learners. It checks every university's own rules, keeps the dates, and stays to the last exam.",
      { x: 0.6, y: 2.6, w: 7.6, h: 0.75, fontSize: 16, color: K.muted },
    );
    T(s, 'Tumo Mogame', {
      x: 9.6,
      y: 2.55,
      w: 3.1,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: K.ink,
      align: 'right',
    });
    T(s, 'Tumoolo', {
      x: 9.6,
      y: 2.9,
      w: 3.1,
      h: 0.3,
      fontSize: 13,
      color: K.muted,
      align: 'right',
    });
    // the journey in pictures, along the path
    const row = [
      [
        'journey-grade10.jpg',
        1300 / 929,
        'GRADE 10',
        'Two Grade 10 learners with school bags and books',
      ],
      ['journey-university.jpg', 1300 / 879, 'UNIVERSITY', 'Two university students holding books'],
      [
        'journey-graduation.jpg',
        1300 / 1289,
        'GRADUATION',
        'Two graduates in gowns and caps, celebrating',
      ],
    ];
    const h = 2.45,
      gap = 0.55;
    let x = 0.75;
    row.forEach(([f, r, label, alt]) => {
      const w = h * r;
      s.addImage({ path: img(f), x, y: 3.75, w, h, altText: alt });
      T(s, label, {
        x,
        y: 6.62,
        w,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: K.brand,
        charSpacing: 3,
        align: 'center',
      });
      x += w + gap;
    });
    pathLine(s, 0.6, 12.73, 6.45, K.brand, 0.32, 0.18, 0.05);
    s.addNotes(
      'Open with the journey: Grade 10, university, graduation. Most help stops at the application. UniversityFlow is the friend who walks the whole way.',
    );
  }

  // ================= 2. THE JOURNEY TODAY =================
  {
    const s = slide(
      'DARK',
      'The problem',
      '##  ·  THE JOURNEY TODAY',
      'Five years where learners fall through the cracks',
    );
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 3.35,
      w: SW,
      h: 1.0,
      fill: { color: K.surface },
      line: { color: K.surface },
    });
    pathLine(s, 0.2, 13.2, 3.85, K.lineStrong || HEX.lineStrong, 0.4, 0.25, 0.06);
    const stops = [
      {
        x: 0.6,
        m: 'GRADE 9 TO 10',
        t: 'Subject choice',
        d: 'Maths or Maths Literacy decides which degrees stay open.',
      },
      {
        x: 3.1,
        m: 'GRADE 11',
        t: 'Results',
        d: 'Many universities make early offers on final Grade 11 marks.',
      },
      {
        x: 5.6,
        m: 'GRADE 12',
        t: 'Apply and fund',
        d: 'Six universities, six ways to score, six closing dates. Then NSFAS.',
      },
      {
        x: 8.1,
        m: 'FIRST YEAR',
        t: 'Arrive',
        d: 'A new city, registration, modules. Many leave after year one.',
      },
      {
        x: 10.6,
        m: 'EVERY YEAR',
        t: 'Finish',
        d: 'DP, subminimum, supplementary: learned the day it costs a year.',
      },
    ];
    stops.forEach((p) => {
      s.addShape(pres.shapes.OVAL, {
        x: p.x + 0.55,
        y: 3.67,
        w: 0.36,
        h: 0.36,
        fill: { color: K.danger },
        line: { color: K.canvas, width: 3 },
      });
      T(s, p.m, {
        x: p.x,
        y: 2.15,
        w: 2.3,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: K.danger,
        charSpacing: 2,
      });
      T(s, p.t, { x: p.x, y: 2.47, w: 2.3, h: 0.75, fontSize: 21, bold: true, color: K.ink });
      T(s, p.d, { x: p.x, y: 4.6, w: 2.15, h: 1.25, fontSize: 14, color: K.body });
    });
    T(
      s,
      '"They may not know what an APS is, which subjects close which doors, when applications close, or what NSFAS needs from them."',
      { x: 0.6, y: 5.85, w: 12.1, h: 0.6, fontSize: 17, italic: true, color: K.accent },
    );
    source(
      s,
      "Quote: UniversityFlow plan, §1.1 (who it's for). The admission rules are summarised from the six universities' prospectuses (plan §2).",
    );
    s.addNotes(
      'Walk the path left to right. Every stop is a place a learner can fall out for lack of information, a missed date, or feeling alone.',
    );
  }

  // ================= 3. MATRIC =================
  {
    const s = slide(
      'DARK_PANEL_R',
      'The problem',
      '##  ·  MATRIC',
      'Under half earn a bachelor pass',
    );
    panel(
      s,
      'p-classroom.jpg',
      'right',
      'Learners in a classroom, seen from behind, facing a teacher',
    );
    s.addText(
      [
        { text: '2025: ', options: { bold: true, color: K.ink } },
        { text: '746 110 full-time candidates wrote. ', options: { color: K.body } },
        { text: '345 857 (46.4%)', options: { bold: true, color: K.accent } },
        {
          text: ' earned a bachelor pass, the pass needed to apply for a degree.',
          options: { color: K.body },
        },
      ],
      {
        isTextBox: true,
        x: 0.6,
        y: 1.75,
        w: 7.5,
        h: 0.7,
        fontSize: 16,
        margin: 0,
        valign: 'top',
        fontFace: 'Outfit',
      },
    );
    s.addImage({
      path: chart('nsc-bachelor-passes.png'),
      x: 0.5,
      y: 2.45,
      w: 7.4,
      h: ((4.3 * 7.4) / 7.4) * 0.93,
      altText:
        'Bar chart, 2019 to 2025: full-time candidates who wrote the NSC and those who achieved a bachelor pass. Bachelor pass rate: 36.9%, 36.4%, 36.4%, 38.4%, 40.9%, 47.8%, 46.4%.',
    });
    source(
      s,
      'Source: DBE, NSC Examination Reports 2021, 2024 and 2025 (full-time candidates). Labels show the bachelor-pass rate.',
      0.6,
      7.6,
    );
  }

  // ================= 4. MATHS =================
  {
    const s = slide(
      'MAUVE_PANEL_L',
      'The problem',
      '##  ·  MATHEMATICS',
      'Maths closes doors early',
    );
    panel(s, 'p-calculator.jpg', 'left', 'A scientific calculator on a page of maths working');
    const x = PW + 0.6;
    const mini = [
      ['254 415', 'wrote Mathematics'],
      ['477 160', 'wrote Maths Literacy'],
      ['25.1%', 'of Maths candidates scored 50% or more'],
    ];
    mini.forEach(([b, l], i) => {
      const xx = x + i * 2.55;
      T(s, b, { x: xx, y: 1.8, w: 2.4, h: 0.6, fontSize: 32, bold: true, color: K.onBrand });
      T(s, l, { x: xx, y: 2.42, w: 2.35, h: 0.6, fontSize: 14, color: K.onBrandSoft });
    });
    card(s, x, 3.15, 7.55, 3.3, HEX.canvas, 'mathsChart');
    T(s, 'NSC 2025, full-time candidates', {
      x: x + 0.3,
      y: 3.3,
      w: 6.9,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: K.ink,
    });
    s.addImage({
      path: chart('maths-2025.png'),
      x: x + 0.15,
      y: 3.62,
      w: 7.2,
      h: 2.75,
      altText:
        'Bar chart, NSC 2025: 746 110 wrote the NSC, 254 415 wrote Mathematics, 162 947 scored 30% or more, 63 813 scored 50% or more, 34 243 scored 60% or more.',
    });
    source(
      s,
      'Source: DBE, 2025 NSC Examination Report (Tables 1, 2.1, 3, 6.3.8). Subjects are chosen before Grade 10; many science, engineering and commerce degrees ask for Mathematics.',
      x,
      7.55,
      K.onBrandSoft,
    );
  }

  // ================= 5. UNIVERSITY =================
  {
    const s = slide(
      'DARK',
      'The problem',
      '##  ·  UNIVERSITY',
      'Getting in is only half the journey',
    );
    T(s, 'Of 100 who started a three-year degree in 2015', {
      x: 0.6,
      y: 1.8,
      w: 4.6,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: K.ink,
    });
    s.addImage({
      path: chart('degree-100.png'),
      x: 0.6,
      y: 2.25,
      w: 3.9,
      h: 3.9,
      altText:
        'One hundred squares: 29 graduated in 3 years, 38 more by year 6, 20 dropped out by year 6, 13 neither.',
    });
    const rows = [
      [HEX.success, '28.6%', 'graduated in three years'],
      [HEX.brand, '38.4%', 'more by year 6 (67.0% in all)'],
      [HEX.danger, '20.2%', 'dropped out by year 6, 13.9% of them after year one'],
      ['6E6875', '12.8%', 'had neither graduated nor dropped out by year 6'],
    ];
    rows.forEach(([col, b, l], i) => {
      const y = 2.3 + i * 0.95;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 4.85,
        y: y + 0.08,
        w: 0.26,
        h: 0.26,
        rectRadius: 0.04,
        fill: { color: col },
        line: { color: col },
      });
      T(s, b, { x: 5.25, y, w: 1.4, h: 0.45, fontSize: 22, bold: true, color: K.ink });
      T(s, l, { x: 5.25, y: y + 0.45, w: 2.9, h: 0.5, fontSize: 13, color: K.body });
    });
    card(s, 8.45, 1.8, 4.25, 4.45, HEX.surface, 'cohorts');
    T(s, 'Finishing on time, by intake', {
      x: 8.7,
      y: 1.98,
      w: 3.8,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: K.ink,
    });
    s.addImage({
      path: chart('degree-cohorts.png'),
      x: 8.55,
      y: 2.4,
      w: 4.05,
      h: (4.05 * 3.6) / 5.6,
      altText:
        'Three-year degrees: graduated in 3 years 20.9%, 26.8%, 28.3%, 28.6% for the 2011, 2013, 2014, 2015 intakes; graduated by year 6 54.6%, 63.9%, 66.0%, 67.0%.',
    });
    T(s, 'Better each year, but fewer than 3 in 10 finish on time.', {
      x: 8.7,
      y: 5.15,
      w: 3.8,
      h: 0.8,
      fontSize: 14,
      color: K.accent,
      italic: true,
    });
    source(
      s,
      'Source: DHET, 2000 to 2019 First Time Entering Undergraduate Cohort Studies (2022), Table 28: three-year degrees, contact and distance (includes UNISA). Squares rounded; labels exact.',
    );
  }

  // ================= 6. FUNDING AND WORK =================
  {
    const s = slide(
      'DARK',
      'The problem',
      '##  ·  MONEY AND WORK',
      'Funding and jobs raise the stakes',
    );
    const cols = [
      [
        I.money,
        '593 543',
        'university students funded by NSFAS in 2025',
        'R47.86 billion paid out for them that year.',
      ],
      [
        I.scale,
        'R350 000',
        'household income a year: the NSFAS limit',
        'R600 000 for students with a disability. Applying is free.',
      ],
      [
        I.briefcase,
        '62.8%',
        'unemployment rate for young people aged 15 to 24',
        'Q2 2026. 3.8 million are not in work, education or training.',
      ],
    ];
    cols.forEach(([ic, big, h, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.95, 3.85, 3.35, HEX.surface, 'stake' + i);
      s.addImage({ data: ic, x: x + 0.3, y: 2.2, w: 0.5, h: 0.5 });
      T(s, big, {
        x: x + 0.3,
        y: 2.85,
        w: 3.3,
        h: 0.75,
        fontSize: 40,
        bold: true,
        color: K.accent,
      });
      T(s, h, { x: x + 0.3, y: 3.65, w: 3.3, h: 0.7, fontSize: 16, bold: true, color: K.ink });
      T(s, d, { x: x + 0.3, y: 4.4, w: 3.3, h: 0.8, fontSize: 14, color: K.body });
    });
    s.addImage({ data: I.grad, x: 0.6, y: 5.6, w: 0.5, h: 0.5 });
    s.addText(
      [
        { text: 'UniversityFlow', options: { color: K.brand, bold: true } },
        {
          text: ' is built so the learner who gets in stays in, and finishes.',
          options: { color: K.ink },
        },
      ],
      {
        isTextBox: true,
        x: 1.3,
        y: 5.6,
        w: 11.3,
        h: 0.5,
        fontSize: 22,
        fontFace: 'Outfit',
        margin: 0,
        valign: 'middle',
      },
    );
    source(
      s,
      'Sources: Minister of Higher Education, reply to Parliament NW874 (2026, via PMG); NSFAS criteria as published by universities (e.g. Rhodes); Stats SA QLFS Q2 2026.',
    );
  }

  // ================= 7. INTRODUCING =================
  {
    const s = slide('MAUVE_PANEL_R', 'The solution', 'INTRODUCING', '');
    panel(
      s,
      'p-graduate-hood.jpg',
      'right',
      'A smiling graduate in a gown with a purple hood, framing the camera with his hands',
    );
    s.addText(brandName(0, { a: K.onBrand, b: K.onBrand }), {
      isTextBox: true,
      x: 0.6,
      y: 1.2,
      w: 7.8,
      h: 1.3,
      fontFace: 'Outfit',
      fontSize: 66,
      bold: true,
      margin: 0,
      valign: 'top',
    });
    pathLine(s, 0.6, 8.2, 2.75, K.onBrand, 0.32, 0.18, 0.06);
    T(s, 'A friend from Grade 10 to graduation.', {
      x: 0.6,
      y: 3.05,
      w: 7.6,
      h: 0.6,
      fontSize: 26,
      bold: true,
      color: K.onBrand,
    });
    T(
      s,
      "It checks a learner's marks against each university's own rules, keeps every date, explains funding, stays close through the exams, and keeps going after the offer: arrival, modules, every year to the last exam.",
      { x: 0.6, y: 3.8, w: 7.4, h: 1.5, fontSize: 17, color: K.onBrandSoft },
    );
    T(s, 'Code decides. The AI explains. A person is always there.', {
      x: 0.6,
      y: 5.55,
      w: 7.4,
      h: 0.5,
      fontSize: 20,
      italic: true,
      color: K.onBrand,
    });
    s.addNotes(
      "The turn of the story: from the dark problem slides to the brand's mauve. Code decides (scores, requirements, deadlines come from checked records); the AI explains them in plain words.",
    );
  }

  // ================= ONE LEARNER'S STORY =================
  {
    const s = slide(
      'DARK',
      'The solution',
      "##  ·  ONE LEARNER'S STORY",
      'Naledi, 16: the first in her family to aim for university',
    );
    const steps = [
      [
        'GRADE 11',
        'Her report, read',
        'She takes a photo of her report. Each mark is read, then confirmed by her. She sees what she is on track for, what is close, and a Plan B.',
      ],
      [
        'GRADE 11',
        'A goal she can see',
        'BCom Accounting at UJ. What I need gives the mark to aim for in each subject. Her plan map ticks off each step.',
      ],
      [
        'GRADE 12',
        'Applied on time, for free',
        'A checklist and closing date for UJ and Wits, her NSFAS documents ready, and a warning: nobody can sell her a place.',
      ],
      [
        'GRADE 12',
        'Through the exams',
        'A countdown to each paper, at most one message a day, and care first on the night she says she is not coping.',
      ],
      [
        'JANUARY',
        'The first week',
        "She accepts UJ's offer. A first-week checklist, the campus tour, and her modules checked before the last day to change them.",
      ],
      [
        'EVERY YEAR',
        'Every module',
        'How each module is marked, her DP, the exam mark she still needs, free books. Then the next year, to graduation.',
      ],
    ];
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 2.75,
      w: SW,
      h: 0.6,
      fill: { color: K.surface },
      line: { color: K.surface },
    });
    pathLine(s, 0.2, 13.2, 3.05, K.brand, 0.3, 0.2, 0.05);
    steps.forEach(([when, h, d], i) => {
      const x = 0.6 + i * 2.05;
      T(s, when, {
        x,
        y: 1.8,
        w: 1.95,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: K.brand,
        charSpacing: 2,
      });
      T(s, h, { x, y: 2.1, w: 1.95, h: 0.6, fontSize: 16, bold: true, color: K.ink });
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.05,
        y: 2.87,
        w: 0.36,
        h: 0.36,
        fill: { color: i === 5 ? K.success : K.brand },
        line: { color: K.canvas, width: 3 },
      });
      T(s, d, { x, y: 3.55, w: 1.9, h: 2.0, fontSize: 13, color: K.body });
    });
    card(s, 0.6, 5.65, 12.1, 0.75, HEX.surface, 'storyNote');
    T(
      s,
      'Every step above is built and on the live demo. Naledi is made up, and so is everything she enters: try her yourself.',
      {
        x: 0.85,
        y: 5.65,
        w: 11.6,
        h: 0.75,
        fontSize: 15,
        italic: true,
        color: K.accent,
        valign: 'middle',
      },
    );
    s.addNotes(
      "The user journey as one story. Naledi is the judge demo's Grade 11 learner (apps/web/lib/server/demo/personas.ts): goal UJ BCom Accounting, shortlist Wits BCom and UJ's Diploma in Accountancy. The exam rhythm is packages/messaging cadence.ts (at most one a day).",
    );
  }

  // ================= 8. HOW IT WORKS =================
  {
    const s = slide('MAUVE', 'The solution', '##  ·  HOW IT WORKS', 'One companion for every stop');
    const cx = 3.25,
      cy = 4.2,
      R = 1.75;
    s.addShape(pres.shapes.OVAL, {
      x: cx - R,
      y: cy - R,
      w: 2 * R,
      h: 2 * R,
      fill: { type: 'none' },
      line: { color: K.onBrand, width: 3, dashType: 'dash' },
    });
    s.addText(
      [
        { text: 'University', options: { color: K.onBrand } },
        { text: 'Flow', options: { color: K.onBrand, italic: true } },
      ],
      {
        isTextBox: true,
        x: cx - 1.3,
        y: cy - 0.3,
        w: 2.6,
        h: 0.6,
        fontSize: 22,
        bold: true,
        fontFace: 'Outfit',
        align: 'center',
        valign: 'middle',
        margin: 0,
      },
    );
    [I.schoolK, I.penK, I.calK, I.campusK, I.gradK].forEach((ic, i) => {
      const a = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
      const x = cx + R * Math.cos(a),
        y = cy + R * Math.sin(a);
      s.addShape(pres.shapes.OVAL, {
        x: x - 0.45,
        y: y - 0.45,
        w: 0.9,
        h: 0.9,
        fill: { color: K.ink },
        line: { color: K.onBrand, width: 2.5 },
      });
      s.addImage({ data: ic, x: x - 0.21, y: y - 0.21, w: 0.42, h: 0.42 });
      T(s, String(i + 1), {
        x: x + 0.32,
        y: y - 0.58,
        w: 0.3,
        h: 0.3,
        fontSize: 13,
        bold: true,
        color: K.onBrand,
      });
    });
    const rows = [
      [
        '1  School',
        "Marks checked against each university's rules: qualify now, close, or Plan B. Subjects that keep doors open.",
        'built',
      ],
      [
        '2  Apply',
        'A checklist and closing date per university. NSFAS: who qualifies, the documents, the free application.',
        'built',
      ],
      [
        '3  Matric',
        'A goal, the exam timetable, reminders and care through the exams. Re-checks after each report.',
        'standin',
      ],
      [
        '4  Arrive',
        'Offers, campus, the first week, and modules checked against the published curriculum.',
        'built',
      ],
      [
        '5  University',
        'Module cards, the mark calculator, free books, plan maps and My CV now. Next: a study coach.',
        'built',
      ],
    ];
    rows.forEach(([h, d, st], i) => {
      const y = 1.8 + i * 0.95;
      T(s, h, { x: 6.5, y, w: 2.0, h: 0.4, fontSize: 19, bold: true, color: K.onBrand });
      T(s, d, { x: 8.5, y, w: 4.25, h: 0.62, fontSize: 13.5, color: K.onBrandSoft });
      chip(s, 6.5, y + 0.45, st);
    });
    s.addNotes(
      'Every row carries an honest status. Built means built, tested and audited, running on local stand-ins until the owner connects the real accounts (SMS, WhatsApp, the production AI key). Next means proposed and waiting for approval.',
    );
  }

  // ================= THE CHALLENGE: FOCUS AREAS =================
  {
    const s = slide(
      'DARK',
      'The solution',
      '##  ·  THE CHALLENGE',
      'Access to higher education: five focus areas, answered',
    );
    const rows = [
      [
        I.money,
        'Applications, bursaries and NSFAS',
        "Every course scored the university's own way, a checklist and closing date each, NSFAS steps and the N+ rule, scam warnings.",
        'Apply and fund',
      ],
      [
        I.coins,
        'Cost planning',
        'What NSFAS pays and who qualifies, the application fee step, money safety before a deposit. Next: a cost-of-study planner.',
        'Money, planned',
      ],
      [
        I.heart,
        'Student wellness',
        'Care before facts, a crisis check before any AI (red team 100%), real helplines, and Report this reply.',
        'Care · Crisis',
      ],
      [
        I.grad,
        'Academic persistence',
        'Registration check, module cards, DP and the exam mark still needed, free books. Next: the study coach.',
        'Arrive · University years',
      ],
      [
        I.phoneB,
        'Connectivity and accessible learning',
        'Light pages for cheap phones, SMS and WhatsApp, an offline calculator, Read aloud, WCAG 2.2 AA tested.',
        'For every learner',
      ],
    ];
    rows.forEach(([ic, h, d, where], i) => {
      const y = 1.8 + i * 0.93;
      card(s, 0.6, y, 12.1, 0.8, HEX.surface, 'focus' + i);
      s.addImage({ data: ic, x: 0.85, y: y + 0.2, w: 0.4, h: 0.4 });
      T(s, h, {
        x: 1.45,
        y,
        w: 3.3,
        h: 0.8,
        fontSize: 15,
        bold: true,
        color: K.ink,
        valign: 'middle',
      });
      T(s, d, { x: 4.85, y, w: 5.6, h: 0.8, fontSize: 12.5, color: K.body, valign: 'middle' });
      T(s, where, {
        x: 10.55,
        y,
        w: 2.0,
        h: 0.8,
        fontSize: 12,
        bold: true,
        color: K.brand,
        align: 'right',
        valign: 'middle',
      });
    });
    source(
      s,
      'Right-hand column: the slide that shows it. Focus areas as listed in the FNB Hackathon 2026 challenge "Access to higher education".',
    );
  }

  // ================= 9. SCHOOL =================
  {
    const s = slide(
      'DARK',
      'The solution',
      '##  ·  SCHOOL, GRADES 10 TO 12',
      "Your marks, against each university's own rules",
    );
    stageTrack(s, ['SCHOOL'], false);
    const rows = [
      [
        I.list,
        'Qualify now, close, or Plan B',
        'Each course scored the way that university scores it: APS, points or its own formula.',
      ],
      [
        I.calc,
        'What I need',
        'The mark to aim for in each subject, for the course the learner wants most.',
      ],
      [
        I.route,
        'Subjects that keep doors open',
        "From Grade 10: which courses a subject choice opens or closes, before it's too late to change.",
      ],
      [
        I.check,
        'Only checked facts',
        'Every requirement carries its source and year. Unchecked records are labelled and never reach real learners.',
      ],
    ];
    rows.forEach(([ic, h, d], i) => {
      const y = 1.85 + i * 1.1;
      s.addImage({ data: ic, x: 0.6, y: y + 0.03, w: 0.4, h: 0.4 });
      T(s, h, { x: 1.2, y, w: 4.3, h: 0.4, fontSize: 17, bold: true, color: K.ink });
      T(s, d, { x: 1.2, y: y + 0.42, w: 4.3, h: 0.62, fontSize: 13, color: K.body });
    });
    laptop(
      s,
      'app-naledi-results-laptop.png',
      5.95,
      2.15,
      4.7,
      "Naledi's My results page on a laptop: courses she is on track for at six universities",
    );
    phone(
      s,
      'app-thabo-subjects-phone.png',
      10.85,
      1.6,
      1.95,
      "Thabo's My subjects page on a phone: your subjects close 35 of the 86 courses here",
    );
    T(s, 'Naledi, Grade 11: My results', {
      x: 5.95,
      y: 5.25,
      w: 4.7,
      h: 0.3,
      fontSize: 11,
      color: K.muted,
    });
    T(s, 'Thabo, Grade 10: My subjects', {
      x: 10.6,
      y: 6.15,
      w: 2.4,
      h: 0.3,
      fontSize: 11,
      color: K.muted,
      align: 'center',
    });
    source(
      s,
      "Today: 86 programmes at Wits, UJ, UP, UCT, TUT and UKZN, researched as drafts and awaiting a person's verification. Screens: the live judge demo, made-up learners.",
      0.6,
      9.8,
    );
  }

  // ================= 10. APPLY AND FUND =================
  {
    const s = slide(
      'MAUVE',
      'The solution',
      '##  ·  APPLY AND FUND',
      'Applications on time. Funding explained',
    );
    stageTrack(s, ['APPLY'], true);
    card(s, 0.6, 1.8, 5.0, 4.6, HEX.canvas, 'applyShots');
    phone(
      s,
      'app-amahle-applications-phone.png',
      0.95,
      1.95,
      2.0,
      "Amahle's Applications page on a phone, with a checklist and closing date per university",
    );
    phone(
      s,
      'app-amahle-funding-phone.png',
      3.25,
      1.95,
      2.0,
      "Amahle's Funding page on a phone: the NSFAS window and who can apply",
    );
    const rows = [
      [
        'Applications',
        'A checklist and closing date for each university, and the next step on the home page.',
        'built',
      ],
      [
        'NSFAS',
        'Who can apply, the window, the documents, and keeping funding (the N+ rule). It explains; NSFAS decides.',
        'built',
      ],
      [
        'Follow-ups',
        "Reminders when an application still has something to do, and before an offer's reply-by date.",
        'standin',
      ],
      [
        'Scam warnings',
        'Nobody can sell a place or a bursary. Applying for NSFAS is free.',
        'built',
      ],
      [
        'Bursaries beyond NSFAS',
        'Matching to bursaries, and pre-filled applications with funders who agree.',
        'partner',
      ],
    ];
    rows.forEach(([h, d, st], i) => {
      const y = 1.75 + i * 0.95;
      T(s, h, { x: 6.0, y, w: 3.4, h: 0.38, fontSize: 17, bold: true, color: K.onBrand });
      const cw = 0.3 + CHIP[st].t.length * 0.085;
      chip(s, 12.73 - cw, y + 0.05, st);
      T(s, d, { x: 6.0, y: y + 0.4, w: 6.7, h: 0.5, fontSize: 13.5, color: K.onBrandSoft });
    });
    source(
      s,
      'Screens: the live judge demo (made-up learner Amahle, Grade 12). Pre-filled funding applications are gate H3 of the plan: only with a signed agreement.',
      0.6,
      12.1,
      K.onBrandSoft,
    );
  }

  // ================= MONEY, PLANNED =================
  {
    const s = slide('DARK', 'The solution', '##  ·  MONEY, PLANNED', 'Cost planning, honestly');
    stageTrack(s, ['APPLY', 'ARRIVE'], false);
    const rows = [
      [
        I.money,
        'What NSFAS pays, who qualifies',
        'Study fees and allowances, for households earning up to R350 000 a year (R600 000 with a disability). The documents, and how to keep funding (the N+ rule).',
        'built',
      ],
      [
        I.receipt,
        'Application fees',
        "The fee step on each university's checklist: paid, or a waiver approved. Some charge nothing: UJ has no application fee.",
        'built',
      ],
      [
        I.shield,
        'Money safety',
        'Never pay anyone for a place, a bursary or an NSFAS application. A check before paying a deposit on an offer.',
        'built',
      ],
      [
        I.hand,
        'Bursaries beyond NSFAS',
        'Matching to bursaries, and pre-filled applications with funders who agree.',
        'partner',
      ],
    ];
    rows.forEach(([ic, h, d, st], i) => {
      const y = 1.8 + i * 1.15;
      s.addImage({ data: ic, x: 0.6, y: y + 0.03, w: 0.4, h: 0.4 });
      T(s, h, { x: 1.2, y, w: 4.2, h: 0.4, fontSize: 17, bold: true, color: K.ink });
      T(s, d, { x: 1.2, y: y + 0.42, w: 5.75, h: 0.7, fontSize: 12.5, color: K.body });
      chip(s, 6.95 - (0.3 + CHIP[st].t.length * 0.085), y + 0.07, st);
    });
    card(s, 7.55, 1.85, 5.15, 4.4, HEX.surface, 'costNext', HEX.brand);
    chip(s, 7.85, 2.1, 'next');
    T(s, 'A cost-of-study planner', {
      x: 7.85,
      y: 2.5,
      w: 4.6,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: K.ink,
    });
    T(
      s,
      'For each course on the shortlist: tuition, residence, transport, books and data, against what NSFAS or a bursary pays, and the gap the family must plan for.',
      { x: 7.85, y: 3.1, w: 4.6, h: 1.5, fontSize: 15, color: K.body },
    );
    T(
      s,
      "Built from each university's published fees, and shown only once a person has checked them. A wrong fee breaks a family's budget; we will not guess one.",
      { x: 7.85, y: 4.65, w: 4.6, h: 1.4, fontSize: 13, italic: true, color: K.accent },
    );
    source(
      s,
      'Built: the Funding page (packages/content funding.ts, safety.ts), the application checklist, the offers reminders. NSFAS limits as published by universities (e.g. Rhodes); UJ: "No application fee" (its 2027 prospectus, a draft record).',
    );
  }

  // ================= 11. EXAMS =================
  {
    const s = slide(
      'DARK',
      'The solution',
      '##  ·  MATRIC, THROUGH THE EXAMS',
      'Close through the exams, never in the way',
    );
    stageTrack(s, ['MATRIC'], false);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 2.6,
      w: 8.6,
      h: 0.8,
      fill: { color: K.surface },
      line: { color: K.surface },
    });
    pathLine(s, 0.2, 8.4, 3.0, HEX.lineStrong, 0.3, 0.2, 0.05);
    const marks = [
      [
        0.6,
        'TERM',
        'Up to 2 a week',
        'Only about their own goal. Nothing to say, nothing sent.',
        K.muted,
      ],
      [
        2.65,
        'A WEEK BEFORE',
        'Up to 1 a day',
        'Study reminders they asked for, never above their own cap.',
        K.brand,
      ],
      [
        4.7,
        'PAPER DAY',
        'Silent',
        'Nothing from an hour before a paper to 30 minutes after.',
        K.accent,
      ],
      [
        6.75,
        'NEW REPORT',
        'Re-check',
        'June and September marks re-run what they qualify for.',
        K.success,
      ],
    ];
    marks.forEach(([x, t, h, d, col]) => {
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.1,
        y: 2.83,
        w: 0.34,
        h: 0.34,
        fill: { color: col },
        line: { color: K.canvas, width: 3 },
      });
      T(s, t, { x, y: 1.85, w: 2.0, h: 0.3, fontSize: 12, bold: true, color: col, charSpacing: 2 });
      T(s, h, { x, y: 2.15, w: 2.0, h: 0.4, fontSize: 19, bold: true, color: K.ink });
      T(s, d, { x, y: 3.6, w: 1.9, h: 1.2, fontSize: 13, color: K.body });
    });
    const pts = [
      [
        I.heart,
        'Motivation that is theirs',
        'The home keeps their goal and the mark each subject needs in view; the chat recalls the goal in their words.',
      ],
      [
        I.lock,
        'Consent first',
        "Opt-in per channel; a guardian's for under-18s. No messages at night. STOP works at once.",
      ],
    ];
    pts.forEach(([ic, h, d], i) => {
      const y = 4.95 + i * 0.8;
      s.addImage({ data: ic, x: 0.6, y: y + 0.02, w: 0.36, h: 0.36 });
      T(s, h, { x: 1.15, y, w: 7.2, h: 0.35, fontSize: 15, bold: true, color: K.ink });
      T(s, d, { x: 1.15, y: y + 0.35, w: 7.3, h: 0.4, fontSize: 13, color: K.body });
    });
    // a real message template (packages/content), on a phone
    const px = 9.25,
      py = 1.45,
      pw = 3.45,
      ph = 5.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: px,
      y: py,
      w: pw,
      h: ph,
      rectRadius: 0.32,
      fill: { color: HEX.surface },
      line: { color: HEX.stageBottom, width: 2 },
      shadow: { type: 'outer', color: '000000', opacity: 0.4, blur: 12, offset: 6, angle: 90 },
    });
    s.addImage({ data: I.comments, x: px + 0.3, y: py + 0.32, w: 0.3, h: 0.3 });
    T(s, 'UniversityFlow  ·  SMS', {
      x: px + 0.7,
      y: py + 0.3,
      w: 2.5,
      h: 0.32,
      fontSize: 13,
      bold: true,
      color: K.ink,
      valign: 'middle',
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: px + 0.22,
      y: py + 0.9,
      w: pw - 0.44,
      h: 1.6,
      rectRadius: 0.1,
      fill: { color: HEX.sunk },
      line: { color: HEX.sunk },
    });
    T(
      s,
      "UniversityFlow: this is the study reminder you asked for. Time for a little practice today. You've got this. Reply STOP to stop.",
      { x: px + 0.37, y: py + 1.02, w: pw - 0.74, h: 1.45, fontSize: 14, color: K.ink },
    );
    T(
      s,
      'Every message is fixed, reviewed text. No name and no marks ever travel in a message: the details wait inside the app.',
      {
        x: px + 0.25,
        y: py + 2.75,
        w: pw - 0.5,
        h: 1.2,
        fontSize: 12,
        italic: true,
        color: K.muted,
      },
    );
    chip(s, px + 0.25, py + 4.2, 'standin');
    source(
      s,
      "Rules as built in packages/messaging (cadence.ts); the numbers are the owner's to confirm. SMS, WhatsApp and push run on stand-ins until a provider is chosen.",
      0.6,
      8.4,
    );
  }

  // ================= 12. CARE =================
  {
    const s = slide('MAUVE_PANEL_L', 'Care', '##  ·  CARE', 'When a learner is struggling');
    panel(s, 'p-window.jpg', 'left', 'A young person sitting alone in a dim room, head bowed');
    const x = PW + 0.6;
    T(s, 'Care comes before facts. The companion asks how they are before it asks about marks.', {
      x,
      y: 1.75,
      w: 7.5,
      h: 0.65,
      fontSize: 17,
      bold: true,
      color: K.onBrand,
    });
    const tiles = [
      [
        I.cloudA,
        'A bad result',
        "Kind and honest: what the marks still allow, and Plan B. Never a promise it can't keep.",
      ],
      [
        I.pencilA,
        'Exam stress',
        'Never "don\'t worry". One small next step from their own timetable, and sleep before a paper.',
      ],
      [
        I.flagA,
        'Giving up',
        'Their own goal, in their own words, without pressure. Another route is not a failure.',
      ],
      [
        I.homeA,
        'Pressure at home',
        'Helps them find the words for family, a teacher or the school counsellor.',
      ],
      [
        I.robotA,
        'An AI, and says so',
        "Asked if it's a person, it says no, and names a parent, teacher or counsellor.",
      ],
      [
        I.mapA,
        'Arriving alone',
        'A lost offer or a hard first week gets care first, then real next steps.',
      ],
    ];
    tiles.forEach(([ic, h, d], i) => {
      const xx = x + (i % 2) * 3.8,
        y = 2.6 + Math.floor(i / 2) * 1.32;
      card(s, xx, y, 3.65, 1.2, HEX.canvas, 'care' + i);
      s.addImage({ data: ic, x: xx + 0.22, y: y + 0.2, w: 0.32, h: 0.32 });
      T(s, h, {
        x: xx + 0.68,
        y: y + 0.17,
        w: 2.85,
        h: 0.38,
        fontSize: 15,
        bold: true,
        color: K.accent,
      });
      T(s, d, { x: xx + 0.22, y: y + 0.58, w: 3.3, h: 0.6, fontSize: 11.5, color: K.body });
    });
    source(
      s,
      'As built: the charter and its care guidance (packages/agent, charter.ts, system-prompt.ts). UniversityFlow is not therapy and never a substitute for a counsellor, doctor or psychologist.',
      x,
      7.6,
      K.onBrandSoft,
    );
    s.addNotes(
      "These are the agent's written rules, tested by the eval suite. The wording of the guidance still goes to a clinician or Childline for review (finding A10-53).",
    );
  }

  // ================= 13. CRISIS =================
  {
    const s = slide(
      'DARK',
      'Care',
      '##  ·  WHEN IT IS MORE THAN SADNESS',
      'A crisis is answered by code, before any AI',
    );
    const flow = [
      [
        'A learner writes',
        'Every message, in the chat or a plan map, is checked first.',
        HEX.muted,
      ],
      [
        'A fixed check',
        'Words of suicide, self-harm or abuse are matched by rules, not a model.',
        HEX.brand,
      ],
      [
        'Coaching stops',
        'A reviewed reply and the crisis card: free helplines, then a person.',
        HEX.danger,
      ],
    ];
    flow.forEach(([h, d, col], i) => {
      const x = 0.6 + i * 2.75;
      card(s, x, 1.85, 2.5, 2.1, HEX.surface, 'flow' + i);
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.22,
        y: 2.05,
        w: 0.42,
        h: 0.42,
        fill: { color: col },
        line: { color: col },
      });
      T(s, String(i + 1), {
        x: x + 0.22,
        y: 2.05,
        w: 0.42,
        h: 0.42,
        fontSize: 14,
        bold: true,
        color: K.canvas,
        align: 'center',
        valign: 'middle',
      });
      T(s, h, { x: x + 0.22, y: 2.6, w: 2.15, h: 0.4, fontSize: 16, bold: true, color: K.ink });
      T(s, d, { x: x + 0.22, y: 3.0, w: 2.1, h: 0.9, fontSize: 12.5, color: K.body });
      if (i < 2)
        s.addShape(pres.shapes.RIGHT_ARROW, {
          x: x + 2.52,
          y: 2.75,
          w: 0.2,
          h: 0.3,
          fill: { color: K.brand },
          line: { color: K.brand },
        });
    });
    const pts = [
      [
        I.shield,
        'It errs towards help',
        'A false alarm costs a few seconds; a miss could cost far more.',
      ],
      [
        I.check,
        'Tested on every change',
        'A red-team suite of over 450 crisis cases must pass 100% for any change to the agent or its words.',
      ],
      [
        I.flag,
        'Report this reply',
        'A button on every AI reply, so a learner can flag a bad answer.',
      ],
    ];
    pts.forEach(([ic, h, d], i) => {
      const y = 4.25 + i * 0.72;
      s.addImage({ data: ic, x: 0.6, y: y + 0.03, w: 0.34, h: 0.34 });
      T(s, h, { x: 1.1, y, w: 2.9, h: 0.4, fontSize: 15, bold: true, color: K.ink });
      T(s, d, { x: 3.9, y: y + 0.02, w: 4.3, h: 0.66, fontSize: 12.5, color: K.body });
    });
    phone(
      s,
      'app-amahle-help-phone.png',
      9.0,
      1.45,
      2.25,
      'The Get help page on a phone: Talk to someone now, with free, confidential helplines',
    );
    T(
      s,
      "Get help: the crisis card's helplines. Numbers blurred here until a person verifies them.",
      { x: 11.45, y: 2.0, w: 1.4, h: 2.4, fontSize: 11, color: K.muted, italic: true },
    );
    source(
      s,
      "Owed before launch, by people: each helpline number checked on the organisation's own site; crisis phrases in isiZulu, isiXhosa, Sesotho, Setswana and Afrikaans reviewed by first-language speakers; the care guidance reviewed by a clinician or Childline (A10-53).",
      0.6,
      8.1,
      K.accent,
    );
    s.addNotes(
      'Built: packages/agent crisis.ts (a deterministic check on every message before any model), the crisis card, the red-team suite in packages/evals (hard rule 7). A design principle is not a clinical guarantee: the reviews above are owed by people.',
    );
  }

  // ================= 14. ARRIVE =================
  {
    const s = slide('DARK', 'The solution', '##  ·  ARRIVE', 'From the offer to the first lecture');
    stageTrack(s, ['ARRIVE'], false);
    laptop(
      s,
      'app-lerato-first-week-laptop.png',
      0.66,
      2.1,
      6.0,
      "Lerato's First week page on a laptop: a step-by-step checklist",
    );
    T(s, 'Lerato, first year at UJ: First week', {
      x: 0.6,
      y: 5.95,
      w: 6,
      h: 0.3,
      fontSize: 11,
      color: K.muted,
    });
    const rows = [
      [
        I.list,
        'Offers',
        'What kind of offer it is, what it still depends on, and the date to reply by.',
      ],
      [
        I.map,
        'Campus and first week',
        "Where things are, walking routes, and the university's own safety advice, quoted.",
      ],
      [
        I.check,
        'Registration check',
        'Modules checked against the published curriculum, before the last day to change them.',
      ],
      [
        I.bell,
        'Reminders',
        'Registration day, reply-by dates, and money safety before paying a deposit.',
      ],
    ];
    rows.forEach(([ic, h, d], i) => {
      const y = 1.9 + i * 1.08;
      s.addImage({ data: ic, x: 7.3, y: y + 0.03, w: 0.38, h: 0.38 });
      T(s, h, { x: 7.85, y, w: 4.8, h: 0.4, fontSize: 17, bold: true, color: K.ink });
      T(s, d, { x: 7.85, y: y + 0.42, w: 4.85, h: 0.6, fontSize: 13, color: K.body });
    });
    chip(s, 7.85, 6.25, 'built');
    source(
      s,
      'Phase 5, built and audited. Campus and curriculum records are drafts until verified.',
      9.4,
      3.3,
    );
  }

  // ================= 15. EVERY YEAR =================
  {
    const s = slide(
      'MAUVE_PANEL_L',
      'The solution',
      '##  ·  UNIVERSITY YEARS',
      'Every year, until the last exam',
    );
    panel(s, 'p-laptops.jpg', 'left', 'Students working together at laptops');
    const x = PW + 0.6;
    const built = [
      [
        'Module cards, mark calculator',
        'How each module is marked: DP, subminimum, and the exam mark still needed. Works offline.',
      ],
      ['Free books', 'Open textbooks and the university library for each module, free and legal.'],
      [
        'Plan maps and My CV',
        'Goal maps you tick off; projects, skills and marks into a first CV (off for real learners until consent v4).',
      ],
    ];
    const next = [
      [
        'Study coach',
        'Reads marked tests, finds weak topics, plans around busy weeks. Phase 7, Mar 2028.',
      ],
      [
        'A plan that fits your life',
        'A study week with room for classes, travel, work, family and rest. Phase 7.',
      ],
      ['Portfolio, My thread', 'Projects built along the way, one degree-long project. Proposed.'],
    ];
    T(s, 'NOW', {
      x,
      y: 1.8,
      w: 3.5,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: K.onBrand,
      charSpacing: 3,
    });
    T(s, 'NEXT', {
      x: x + 3.85,
      y: 1.8,
      w: 3.5,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: K.onBrand,
      charSpacing: 3,
    });
    [
      [built, x, ['built', 'built', 'switch']],
      [next, x + 3.85, ['next', 'next', 'next']],
    ].forEach(([list, xx, st]) => {
      list.forEach(([h, d], i) => {
        const y = 2.15 + i * 1.32;
        card(s, xx, y, 3.65, 1.2, HEX.canvas, 'yr' + i);
        T(s, h, {
          x: xx + 0.22,
          y: y + 0.15,
          w: 3.25,
          h: 0.36,
          fontSize: 15,
          bold: true,
          color: K.accent,
        });
        T(s, d, { x: xx + 0.22, y: y + 0.5, w: 3.25, h: 0.68, fontSize: 12, color: K.body });
      });
    });
    T(
      s,
      'The aim: catch a missed DP or a wrong module before the next semester, while there is still time to fix it.',
      { x, y: 6.27, w: 7.5, h: 0.45, fontSize: 14, italic: true, color: K.onBrand },
    );
  }

  // ================= INTELLIGENCE =================
  {
    const s = slide(
      'DARK',
      'The solution',
      '##  ·  IT THINKS AHEAD',
      "Forecasts from the learner's own marks, explained",
    );
    const rows = [
      [
        'AT SCHOOL',
        [
          [
            I.chart,
            'Where marks are heading',
            'The pass her marks would give, and each subject’s change since Grade 10.',
          ],
          [
            I.list,
            'Every course, forecast',
            'Qualify now, on track, close or Plan B, each scored the university’s own way.',
          ],
          [I.target, 'What I need', 'The mark to aim for in each subject to reach her goal.'],
          [I.rotate, 'Re-check', 'After each new report: which courses moved up, which slipped.'],
        ],
      ],
      [
        'AT UNIVERSITY, AND ALWAYS',
        [
          [
            I.calc,
            'The exam mark needed',
            'From the year mark so far: DP met or not, the subminimum, what the exam must give.',
          ],
          [
            I.memory,
            'It remembers',
            'Goals, preferences and notes, kept across years. The learner sees and deletes them.',
          ],
          [
            I.moon,
            'Knows when to be quiet',
            'Messages fit her exam timetable: at most one a day, never during a paper or after 21:00.',
          ],
          [
            I.life,
            'Reads distress first',
            'A crisis check on every message, before the AI, then a person to talk to.',
          ],
        ],
      ],
    ];
    rows.forEach(([label, cards], r) => {
      const y = 1.75 + r * 2.05;
      T(s, label, {
        x: 0.6,
        y,
        w: 6,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: K.brand,
        charSpacing: 2,
      });
      cards.forEach(([ic, h, d], i) => {
        const x = 0.6 + i * 3.06;
        card(s, x, y + 0.35, 2.9, 1.55, HEX.surface, `think${r}${i}`);
        s.addImage({ data: ic, x: x + 0.2, y: y + 0.52, w: 0.34, h: 0.34 });
        T(s, h, {
          x: x + 0.65,
          y: y + 0.47,
          w: 2.15,
          h: 0.45,
          fontSize: 14,
          bold: true,
          color: K.ink,
          valign: 'middle',
        });
        T(s, d, { x: x + 0.2, y: y + 0.97, w: 2.55, h: 0.9, fontSize: 12, color: K.body });
        if (r === 0 && i < 3)
          T(s, '→', {
            x: x + 2.88,
            y: y + 0.85,
            w: 0.2,
            h: 0.4,
            fontSize: 16,
            bold: true,
            color: K.brand,
            align: 'center',
          });
      });
    });
    card(s, 0.6, 5.85, 12.1, 0.65, HEX.sunk, 'thinkHow');
    s.addText(
      [
        { text: 'How it thinks: ', options: { bold: true, color: K.accent } },
        {
          text: 'the AI picks among 18 tools, code works out the answer, the AI explains it. Next (Phase 7): a study coach that ranks topics by the marks they cost across tests and their weight in the exam.',
          options: { color: K.body },
        },
      ],
      {
        isTextBox: true,
        x: 0.85,
        y: 5.85,
        w: 11.7,
        h: 0.65,
        fontSize: 13,
        fontFace: 'Outfit',
        margin: 0,
        valign: 'middle',
      },
    );
    source(
      s,
      'Built: packages/admissions (eligibility, school-record, what-i-need, recheck, mark-needed), packages/agent (tools.ts, crisis.ts), packages/messaging (cadence.ts). Phase 7: docs/plans/phase-7-proposal.md.',
    );
    s.addNotes(
      'Why code decides: a wrong requirement or deadline costs a learner a year, so every forecast here can be explained and checked. No predicted exam mark is ever shown as a promise (Phase 7, D8). A Bayesian Knowledge Tracing model replaces the v1 heuristic only once it predicts the next test better on consented, de-identified data.',
    );
  }

  // ================= FOR EVERY LEARNER =================
  {
    const s = slide(
      'MAUVE',
      'The solution',
      '##  ·  FOR EVERY LEARNER',
      'Connectivity and accessible learning',
    );
    const tiles = [
      [
        I.wifiA,
        'Light on data',
        'Built for cheap phones: the shared code every page loads is held under 150 KB, checked on every change.',
        'built',
      ],
      [
        I.smsA,
        'SMS and WhatsApp',
        'Reminders and replies without the app or a data bundle.',
        'standin',
      ],
      [
        I.offlineA,
        'Works offline',
        'The mark calculator runs on the phone. Lost signal? It says so and tries again.',
        'built',
      ],
      [
        I.voiceA,
        'Read aloud',
        'Campus places and directions read out, with step-free routes.',
        'built',
      ],
      [
        I.bookA,
        'Free, legal books',
        'Open textbooks and practice for school, the university library for every module.',
        'built',
      ],
      [
        I.accessA,
        'Accessible by design',
        'WCAG 2.2 AA, every journey tested with axe, from a 360 px phone up, reduced motion.',
        'built',
      ],
      [
        I.langA,
        'Five languages in a crisis',
        'Crisis words recognised in isiZulu, isiXhosa, Sesotho, Setswana and Afrikaans.',
        'built',
      ],
      [
        I.freeA,
        'Free for learners',
        'No fee, no adverts, nothing sold. The payers are those who gain when learners finish.',
        'built',
      ],
    ];
    tiles.forEach(([ic, h, d, st], i) => {
      const x = 0.6 + (i % 4) * 3.06,
        y = 1.8 + Math.floor(i / 4) * 2.3;
      card(s, x, y, 2.9, 2.1, HEX.canvas, 'access' + i);
      s.addImage({ data: ic, x: x + 0.22, y: y + 0.22, w: 0.36, h: 0.36 });
      T(s, h, {
        x: x + 0.72,
        y: y + 0.18,
        w: 2.1,
        h: 0.45,
        fontSize: 14,
        bold: true,
        color: K.accent,
        valign: 'middle',
      });
      T(s, d, { x: x + 0.22, y: y + 0.72, w: 2.5, h: 0.95, fontSize: 12, color: K.body });
      chip(s, x + 0.22, y + 1.7, st);
    });
    T(
      s,
      'SMS and WhatsApp run on stand-ins until a provider is chosen. Crisis phrases await first-language review.',
      {
        x: 0.6,
        y: 6.5,
        w: 12.1,
        h: 0.4,
        fontSize: 11,
        italic: true,
        color: K.onBrandSoft,
        valign: 'bottom',
      },
    );
  }

  // ================= ARCHITECTURE =================
  {
    const s = slide('DARK', 'The solution', '##  ·  UNDER THE HOOD', 'Technical architecture');
    const box = (x, y, w, h, title, body, fill = HEX.surface, line) => {
      card(s, x, y, w, h, fill, 'arch' + x + y, line);
      T(s, title, {
        x: x + 0.18,
        y: y + 0.1,
        w: w - 0.36,
        h: 0.35,
        fontSize: 13,
        bold: true,
        color: K.ink,
      });
      if (body)
        T(s, body, {
          x: x + 0.18,
          y: y + 0.45,
          w: w - 0.36,
          h: h - 0.5,
          fontSize: 11,
          color: K.body,
        });
    };
    const arrow = (x, y) =>
      T(s, '↓', {
        x,
        y,
        w: 0.4,
        h: 0.3,
        fontSize: 16,
        bold: true,
        color: K.brand,
        align: 'center',
      });
    // channels
    box(0.6, 1.75, 2.9, 0.95, 'Web app', 'Next.js 16, installable, any browser');
    box(3.65, 1.75, 2.9, 0.95, 'Phone app', 'Expo: Android and iOS, one codebase');
    box(6.7, 1.75, 2.9, 0.95, 'SMS and WhatsApp', 'Reminders, replies, STOP honoured');
    arrow(3.4, 2.72);
    // API
    box(
      0.6,
      3.05,
      9.0,
      0.8,
      'API on Vercel, Cape Town',
      'Sign-in by phone PIN · guardian consent gate · rate limits · security headers. The app never holds a key or calls the AI.',
      HEX.sunk,
    );
    arrow(3.4, 3.87);
    // core
    box(
      0.6,
      4.2,
      4.4,
      1.75,
      'Code decides',
      'admissions: scores, verdicts, What I need, mark maths\ncatalogue: every record with source, year, checked by\nmessaging · documents (each mark confirmed) · planner',
      HEX.surface,
      HEX.brand,
    );
    box(
      5.2,
      4.2,
      4.4,
      1.75,
      'The AI explains',
      'crisis check first, then the model behind an interface (Claude; Gemini on the demo only), 18 tools, the care charter. Red team: over 450 cases, 100%.',
      HEX.surface,
      HEX.brand,
    );
    // data and providers
    box(
      9.85,
      1.75,
      2.85,
      2.1,
      'Data, in South Africa',
      'Postgres and file storage in AWS Cape Town (af-south-1). Row-level security. IDs only in logs. The demo: made-up learners only.',
      HEX.sunk,
    );
    box(
      9.85,
      4.0,
      2.85,
      1.95,
      'Every provider swappable',
      'AI, SMS, WhatsApp, push, voice, CV (Mmereko), jobs, errors: each behind an interface, with a fake and contract tests.',
      HEX.sunk,
    );
    card(s, 0.6, 6.05, 12.1, 0.5, HEX.brand, 'archBar');
    T(
      s,
      'One TypeScript monorepo · over 5 000 automated tests · guards in CI · 13 audit types per phase · E2E with axe on a production build',
      {
        x: 0.8,
        y: 6.05,
        w: 11.7,
        h: 0.5,
        fontSize: 13,
        bold: true,
        color: K.onBrand,
        valign: 'middle',
        align: 'center',
      },
    );
    s.addNotes(
      'Repository: planning.md §16 (stack and structure) and §16.4 (hard rules). The demo runs on its own Vercel project with a Supabase database and made-up learners only; production is Vercel cpt1 with RDS and S3 in af-south-1. Test count: the per-package suites in status.md (web 1887, catalogue 555, db 565, native 470, agent 390, messaging 311, documents 302, admissions 299, tokens 289 and more).',
    );
  }

  // ================= 16. DEMO =================
  {
    const s = slide(
      'DARK',
      'The demo',
      '##  ·  WHAT WE SHOW TODAY',
      'Live demo: six made-up learners, one journey',
    );
    const steps = [
      [
        'Thabo',
        'Grade 10',
        'My subjects: swap a subject and see which courses it opens or closes.',
      ],
      ['Naledi', 'Grade 11', 'My results, then What I need for the course she wants.'],
      ['Amahle', 'Grade 12', 'Applications and their checklists, then Funding for NSFAS.'],
      ['Lerato', 'First year, UJ', 'First week: tick a step, then the campus tour.'],
      ['Sipho', 'Second year, Wits', 'My modules, then ask the chat how to find a place.'],
      ['Kagiso', 'Final year, UCT', "The campus tour, then what's coming next."],
    ];
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 2.55,
      w: SW,
      h: 0.7,
      fill: { color: K.surface },
      line: { color: K.surface },
    });
    pathLine(s, 0.2, 13.2, 2.9, HEX.lineStrong, 0.3, 0.2, 0.05);
    steps.forEach(([n, g, d], i) => {
      const x = 0.6 + i * 2.05;
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.05,
        y: 2.6,
        w: 0.6,
        h: 0.6,
        fill: { color: i === 5 ? K.success : K.brand },
        line: { color: K.canvas, width: 3 },
      });
      T(s, String(i + 1).padStart(2, '0'), {
        x: x + 0.05,
        y: 2.6,
        w: 0.6,
        h: 0.6,
        fontSize: 14,
        bold: true,
        color: K.canvas,
        align: 'center',
        valign: 'middle',
      });
      T(s, n, { x, y: 1.8, w: 1.95, h: 0.4, fontSize: 19, bold: true, color: K.ink });
      T(s, g, { x, y: 2.17, w: 1.95, h: 0.3, fontSize: 12, color: K.brand, bold: true });
      T(s, d, { x, y: 3.45, w: 1.85, h: 1.35, fontSize: 13, color: K.body });
    });
    card(s, 0.6, 4.95, 12.1, 1.5, HEX.surface, 'demoNote');
    s.addImage({
      path: img('qr-demo.png'),
      x: 0.8,
      y: 5.07,
      w: 1.26,
      h: 1.26,
      altText: 'QR code for universityflow.tumoolo.tech/demo',
    });
    T(s, 'universityflow.tumoolo.tech/demo', {
      x: 2.3,
      y: 5.1,
      w: 5.2,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: K.accent,
    });
    T(s, 'NO PASSWORD NEEDED', {
      x: 7.6,
      y: 5.14,
      w: 4.9,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: K.success,
      charSpacing: 2,
      align: 'right',
    });
    T(
      s,
      [
        { text: 'Press ', options: {} },
        { text: 'Try as Naledi', options: { bold: true, color: K.ink } },
        { text: ' (or any learner): a private copy, deleted after 24 hours. Or ', options: {} },
        { text: 'Sign up as a new learner', options: { bold: true, color: K.ink } },
        {
          text: ' with any 080 number: the PIN shows on screen. University facts are drafts, labelled "Not yet verified". The chat is the real AI, with every safety check on.',
          options: {},
        },
      ],
      { x: 2.3, y: 5.52, w: 10.2, h: 0.9, fontSize: 13, color: K.body },
    );
    s.addNotes(
      'Judge takeaway: it already works across the whole journey, on made-up learners, with every safety rule on. Nothing real is at stake in the demo.',
    );
  }

  // ================= BUILT THIS WEEKEND =================
  {
    const s = slide(
      'DARK',
      'The demo',
      '##  ·  BUILT THIS WEEKEND',
      '56 changes shipped from 23 to 25 October',
    );
    T(s, '56', { x: 0.6, y: 1.75, w: 3.4, h: 1.3, fontSize: 88, bold: true, color: K.accent });
    T(
      s,
      'pull requests merged during the hackathon, each through the full test gate before it went live',
      {
        x: 0.6,
        y: 3.1,
        w: 3.4,
        h: 1.2,
        fontSize: 16,
        bold: true,
        color: K.ink,
      },
    );
    T(
      s,
      'Before the weekend: Phases 0 to 5 (the school years to arrival) were built and audited, September to October 2026.',
      { x: 0.6, y: 4.45, w: 3.4, h: 1.3, fontSize: 13, color: K.muted },
    );
    const done = [
      [
        'The judge demo',
        'Six made-up learners, a private copy each, a three-minute guide, live on universityflow.tumoolo.tech.',
      ],
      [
        'Sign up as a new learner',
        'The real sign-up journey on made-up details: PIN and guardian link on screen.',
      ],
      [
        'Phase 6: semester setup',
        'How marks work, the module outline, module cards and the mark calculator, free books.',
      ],
      ['50 TVET colleges', 'Every public college in Plan B, and "Is this college registered?"'],
      [
        'My CV and plan maps',
        'A first CV (with Mmereko, behind a switch); plan maps you pan, zoom and tick off.',
      ],
      ['A second AI model', 'Gemini beside Claude; every reply records which model wrote it.'],
      [
        'Safer',
        'Two Critical framework advisories patched; two crisis gaps closed, each with a failing test first.',
      ],
    ];
    done.forEach(([h, d], i) => {
      const y = 1.8 + i * 0.66;
      s.addImage({ data: I.check, x: 4.6, y: y + 0.06, w: 0.3, h: 0.3 });
      T(s, h, { x: 5.05, y, w: 2.9, h: 0.6, fontSize: 14, bold: true, color: K.ink });
      T(s, d, { x: 7.95, y, w: 4.75, h: 0.6, fontSize: 12, color: K.body });
    });
    source(
      s,
      'From the repository history, 23 to 25 October 2026: pull requests #81 to #138, not counting automated dependency updates and one empty merge.',
    );
  }

  // ================= 17. TRUST BY DESIGN =================
  {
    const s = slide(
      'MAUVE_PANEL_L',
      'The value',
      '##  ·  TRUST BY DESIGN',
      "Built for children's data",
    );
    panel(s, 'p-library.jpg', 'left', 'A girl reading a book in a library');
    const tiles = [
      [
        I.lockA,
        'Data stays in South Africa',
        "Real learners' data in AWS Cape Town (af-south-1). The demo holds made-up learners only.",
      ],
      [
        I.userA,
        'Guardian consent',
        "Nothing about an under-18 is processed before a guardian's consent is recorded, in the database.",
      ],
      [
        I.codeA,
        'Code decides',
        'Requirements, deadlines and scores only from checked records. The AI never works them out.',
      ],
      [
        I.banA,
        'Never their password',
        'We never log into a university system as a learner. A student number is profile data.',
      ],
      [
        I.eyeA,
        'POPIA by design',
        'IDs only in logs and jobs. Learners confirm every mark read from a document.',
      ],
      [
        I.heartA,
        'Care first',
        'A crisis check on every message, a 100% red-team suite, a human route always.',
      ],
    ];
    tiles.forEach(([ic, h, d], i) => {
      const x = PW + 0.6 + (i % 2) * 3.85,
        y = 1.85 + Math.floor(i / 2) * 1.55;
      card(s, x, y, 3.7, 1.4, HEX.canvas, 'trust' + i);
      s.addImage({ data: ic, x: x + 0.22, y: y + 0.22, w: 0.34, h: 0.34 });
      T(s, h, {
        x: x + 0.7,
        y: y + 0.19,
        w: 2.9,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: K.accent,
      });
      T(s, d, { x: x + 0.22, y: y + 0.66, w: 3.3, h: 0.7, fontSize: 12, color: K.body });
    });
  }

  // ================= 18. WHO PAYS =================
  {
    const s = slide(
      'DARK',
      'The value',
      '##  ·  WHO PAYS, AND WHY',
      'Free for learners, paid for by those who gain',
    );
    T(s, 'R0', { x: 0.6, y: 1.7, w: 5, h: 1.2, fontSize: 80, bold: true, color: K.accent });
    T(s, 'for learners, always. The people who lose money when a student drops out pay instead.', {
      x: 0.6,
      y: 2.9,
      w: 5.0,
      h: 0.75,
      fontSize: 16,
      bold: true,
      color: K.ink,
    });
    T(
      s,
      'One NSFAS-funded student costs about R80 600 a year (R47.86 billion for 593 543 students in 2025). Keep one learner in 200 from dropping out, and the sponsorship for all 200 has paid for itself.',
      { x: 0.6, y: 3.75, w: 5.0, h: 1.2, fontSize: 14, color: K.body },
    );
    s.addImage({
      path: chart('nsfas-students.png'),
      x: 0.45,
      y: 4.95,
      w: 5.2,
      h: 1.5,
      altText:
        'NSFAS-funded university students: 509 978 in 2023, 561 130 in 2024, 593 543 in 2025.',
    });
    const payers = [
      [
        I.hand,
        'Sponsor a learner',
        'R420 a year each',
        'R35 a month, paid by companies (CSI and B-BBEE), bursary funders and SETAs. Anonymous impact reports.',
      ],
      [
        I.book,
        'Schools',
        'R6 000 a year',
        'Per fee-paying school, Grades 10 to 12. No-fee schools are free, sponsored.',
      ],
      [
        I.grad,
        'Universities, from 2028',
        'R250 000 a year',
        'Per university: first-year arrival, registration check, study coach. A pilot at R100 000.',
      ],
      [
        I.briefcase,
        'Employers, from 2029',
        'R2 500 a month',
        'Reach graduates who chose to share their CV (18 and over only).',
      ],
    ];
    payers.forEach(([ic, h, price, d], i) => {
      const y = 1.75 + i * 1.17;
      card(s, 6.2, y, 6.5, 1.05, HEX.surface, 'payer' + i);
      s.addImage({ data: ic, x: 6.42, y: y + 0.3, w: 0.42, h: 0.42 });
      T(s, h, { x: 7.05, y: y + 0.1, w: 2.6, h: 0.36, fontSize: 15, bold: true, color: K.ink });
      T(s, price, {
        x: 9.55,
        y: y + 0.1,
        w: 3.0,
        h: 0.36,
        fontSize: 13,
        bold: true,
        color: K.accent,
        align: 'right',
      });
      T(s, d, { x: 7.05, y: y + 0.5, w: 5.5, h: 0.5, fontSize: 12, color: K.body });
    });
    source(
      s,
      "R80 600 is our arithmetic on the Minister's reply to Parliament (NW874, 2026). Prices are UniversityFlow's proposal (25 Oct 2026); no payer has signed yet.",
    );
  }

  // ================= WHAT IT COSTS =================
  {
    const s = slide(
      'DARK',
      'The value',
      '##  ·  WHAT IT COSTS',
      'About R10.50 a learner a month to run',
    );
    const table = (x, y, w, head, rows, total) => {
      T(s, head, { x, y, w, h: 0.3, fontSize: 11, bold: true, color: K.brand, charSpacing: 2 });
      rows.forEach(([a, b], i) => {
        const yy = y + 0.4 + i * 0.4;
        T(s, a, { x, y: yy, w: w - 1.5, h: 0.36, fontSize: 13, color: K.body, valign: 'middle' });
        T(s, b, {
          x: x + w - 1.5,
          y: yy,
          w: 1.5,
          h: 0.36,
          fontSize: 13,
          color: K.ink,
          align: 'right',
          valign: 'middle',
        });
      });
      const yt = y + 0.45 + rows.length * 0.4;
      s.addShape(pres.shapes.LINE, {
        x,
        y: yt,
        w,
        h: 0,
        line: { color: HEX.lineStrong, width: 1 },
      });
      T(s, total[0], {
        x,
        y: yt + 0.05,
        w: w - 1.5,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: K.ink,
        valign: 'middle',
      });
      T(s, total[1], {
        x: x + w - 1.5,
        y: yt + 0.05,
        w: 1.5,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: K.accent,
        align: 'right',
        valign: 'middle',
      });
    };
    table(
      0.6,
      1.8,
      5.6,
      'PER ACTIVE LEARNER, PER MONTH',
      [
        ['AI chat: 30 replies (Claude Sonnet 5.5, cached)', 'R7.50'],
        ['Reading a school report (Claude Opus 5.5)', 'R0.35'],
        ['SMS: sign-in PINs and reminders', 'R1.20'],
        ['WhatsApp: 10 utility messages', 'R1.20'],
        ['Hosting, per learner', 'R0.25'],
      ],
      ['Variable cost', 'R10.50'],
    );
    table(
      6.9,
      1.8,
      5.8,
      'FIXED, PER MONTH (YEAR 1)',
      [
        ['Hosting and database, Cape Town', 'R2 000'],
        ['WhatsApp provider, monitoring, jobs, voice', 'R4 800'],
        ['Legal and POPIA, fact checkers', 'R11 000'],
        ['App stores', 'R150'],
        ['Team: founder and a part-time developer', 'R45 000'],
      ],
      ['Fixed cost', 'about R63 000'],
    );
    const stats = [
      ['R24.50', 'margin a month on each sponsored learner (R35 less R10.50)'],
      ['2 600', 'sponsored learners to break even'],
      [
        'R1.8 m',
        'Year 1 target: 5 000 learners (4 000 sponsored) and 20 schools, against about R1.39 m in costs',
      ],
    ];
    stats.forEach(([big, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 4.95, 3.85, 1.4, HEX.surface, 'unit' + i);
      T(s, big, {
        x: x + 0.25,
        y: 5.02,
        w: 3.4,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: K.accent,
      });
      T(s, d, { x: x + 0.25, y: 5.62, w: 3.4, h: 0.7, fontSize: 12, color: K.body });
    });
    source(
      s,
      'Estimates, 25 Oct 2026, at R18 to the US$. AI: Anthropic list prices with prompt caching; Haiku 5.5 for simple replies would bring the total to about R6. SMS and WhatsApp: plan §7.4. Hosting: docs/deploy/costs.md. Measured once the real AI key runs.',
    );
  }

  // ================= 19. ROADMAP =================
  {
    const s = slide(
      'DARK',
      'The plan',
      '##  ·  ROADMAP',
      'Timed to the first cohort: Grade 11 in 2026',
    );
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 2.35,
      w: SW,
      h: 0.6,
      fill: { color: K.surface },
      line: { color: K.surface },
    });
    pathLine(s, 0.2, 13.2, 2.65, HEX.lineStrong, 0.3, 0.2, 0.05);
    const ms = [
      [
        'NOW  ·  OCT 2026',
        'Built',
        'Phases 0 to 5 and most of 6 on stand-ins, tested and audited. The judge demo is live.',
        K.success,
      ],
      [
        'MAR 2027  ·  MVP',
        'Applications open',
        'Results, applications, funding, for real learners once data, legal and accounts are in.',
        K.brand,
      ],
      [
        'JUN 2027',
        'Exams, app stores',
        'WhatsApp, SMS and push live before the June exams.',
        K.muted,
      ],
      [
        'JAN TO FEB 2028',
        'Arrive and set up',
        'Offers, registration, then semester setup (Phase 6).',
        K.muted,
      ],
      [
        'MAR TO NOV 2028',
        'Coach and portfolio',
        'Study coach (Phase 7), then portfolio and career (Phase 9).',
        K.muted,
      ],
    ];
    ms.forEach(([k, h, d, col], i) => {
      const x = 0.6 + i * 2.48;
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.1,
        y: 2.47,
        w: 0.36,
        h: 0.36,
        fill: { color: col },
        line: { color: K.canvas, width: 3 },
      });
      T(s, k, {
        x,
        y: 1.85,
        w: 2.4,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: col,
        charSpacing: 1,
      });
      T(s, h, { x, y: 3.15, w: 2.3, h: 0.45, fontSize: 17, bold: true, color: K.ink });
      T(s, d, { x, y: 3.62, w: 2.25, h: 1.3, fontSize: 13, color: K.body });
    });
    card(s, 0.6, 5.1, 12.1, 1.3, HEX.brand, 'gates');
    T(s, 'PARTNER GATES  ·  EACH ONLY WITH A SIGNED AGREEMENT', {
      x: 0.9,
      y: 5.22,
      w: 11,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: K.onBrand,
      charSpacing: 2,
    });
    T(
      s,
      'H1 2027: apply with UniversityFlow at one university (UJ first).   H2 Jan 2028: official NSC results with the DBE.   H3 2028: NSFAS and bursary funders accept pre-filled applications.',
      { x: 0.9, y: 5.55, w: 11.6, h: 0.8, fontSize: 14, color: K.onBrand },
    );
  }

  // ================= 20. THE ASK =================
  {
    const s = slide('MAUVE_PANEL_L', 'Closing', 'THE DESTINATION', 'A learner who finishes');
    panel(
      s,
      'p-cap.jpg',
      'left',
      'A graduate seen from behind, holding her cap up in front of a columned building',
    );
    const x = PW + 0.6;
    T(s, 'Our ask: help us open UniversityFlow to real learners by March 2027.', {
      x,
      y: 1.85,
      w: 7.5,
      h: 0.9,
      fontSize: 22,
      bold: true,
      color: K.onBrand,
    });
    [
      'People to verify the university data (86 programmes, six universities)',
      'A legal review of consent for under-18s (POPIA)',
      'An SMS and WhatsApp provider',
      "Hosting in AWS Cape Town (af-south-1) for learners' data",
      'A first university partner, and bursary funders',
    ].forEach((a, i) => {
      s.addImage({ data: I.checkK, x, y: 3.0 + i * 0.52, w: 0.3, h: 0.3 });
      T(s, a, { x: x + 0.45, y: 2.97 + i * 0.52, w: 7.1, h: 0.42, fontSize: 15, color: K.onBrand });
    });
    pathLine(s, x, 12.7, 5.85, K.onBrand, 0.32, 0.18, 0.06);
    s.addText(brandName(0, { a: K.onBrand, b: K.onBrand }), {
      isTextBox: true,
      x,
      y: 6.0,
      w: 4.3,
      h: 0.7,
      fontSize: 36,
      bold: true,
      fontFace: 'Outfit',
      margin: 0,
      valign: 'middle',
    });
    T(s, 'From Grade 10 to graduation.', {
      x: x + 4.3,
      y: 6.12,
      w: 3.3,
      h: 0.5,
      fontSize: 16,
      italic: true,
      color: K.onBrand,
      valign: 'middle',
    });
    s.addNotes(
      'Close on the destination: not an application sent, a learner who finishes. The ask is what stands between the built product and real learners (status.md, Blocked on).',
    );
  }

  // ================= 21. SOURCES =================
  {
    const s = slide('DARK', 'Appendix', 'APPENDIX', 'Sources');
    const src = [
      'DBE, 2025 NSC Examination Report (Tables 1, 2, 2.1, 3, 6.3.8), 2026. education.gov.za',
      'DBE, 2024 NSC Examination Report (Tables 1, 6.1.4, 6.3.3; Figure 2), 2025. education.gov.za',
      'DBE, NSC Examination Report 2021 (Tables 2, 6.2.1, 6.3.9), 2022. education.gov.za',
      'DHET, 2000 to 2019 First Time Entering Undergraduate Cohort Studies for Public HEIs, 22 Feb 2022, Table 28. dhet.gov.za',
      'Minister of Higher Education, written reply to question NW874 (NSFAS funding 2023 to 2025), 2026. pmg.org.za/committee-question/37471',
      "NSFAS household income criteria, as published by Rhodes University (ru.ac.za/registrar/nsfas); NSFAS's own site could not be reached",
      'Stats SA, Quarterly Labour Force Survey Q2 2026, media release and presentation, 11 Aug 2026. statssa.gov.za',
      'UniversityFlow plan (planning.md §0, §1, §2, §7, §10, §11, §19) and status (status.md, 24 Oct 2026), in the repository',
      'Built behaviour: packages/messaging (cadence.ts), packages/agent (crisis.ts, charter.ts, system-prompt.ts), packages/content (messages.ts)',
      'Screens: the live judge demo, universityflow.tumoolo.tech, made-up learners, captured 25 Oct 2026',
      'Costs: Anthropic list prices (Oct 2026); docs/deploy/costs.md (hosting, checked 23 Oct 2026); plan §7.4 (SMS, WhatsApp). Estimates at R18 to the US dollar',
      'Full list with exact URLs, numbers and image credits: pitch/README.md',
    ];
    T(
      s,
      src.map((t, i) => ({
        text: `${i + 1}.  ${t}`,
        options: { breakLine: i < src.length - 1, paraSpaceAfter: 6 },
      })),
      { x: 0.6, y: 1.85, w: 12.1, h: 4.9, fontSize: 13, color: K.body },
    );
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT, count, 'slides');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
