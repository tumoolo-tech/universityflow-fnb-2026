/**
 * The judge demo's university logos: the owner's decision of 2026-10-23, for the FNB hackathon
 * only, set aside option A (docs/brand/logo-permissions.md) for the demo. **Remove after the
 * hackathon**, or once each university has answered: then a real `logoPermission` takes over.
 *
 * Shown only when the demo's own build sets `NEXT_PUBLIC_UF_DEMO_LOGOS=1` (inlined at build time,
 * so client components see it too); production and staging refuse that variable (config.ts), and
 * the banner then says the logos are for the demo only, with no affiliation (`en.demo.logosNotice`).
 * The files are each university's own, unaltered, downloaded from its website on 2026-10-23 into
 * `apps/web/public/demo-logos/`. UJ and UP followed on 2026-10-24 (their main sites refuse
 * automated visitors, so each came from another of the university's own sites; sources below).
 * No university has granted a `logoPermission`: these show only under the demo exception.
 */

export interface DemoLogo {
  /** Served from our own origin. */
  readonly src: string;
  /** The chip behind it: `light` for dark artwork, `dark` for white artwork, so both show. */
  readonly backing: 'light' | 'dark';
}

const WITS: DemoLogo = { src: '/demo-logos/wits.svg', backing: 'light' };
const TUT: DemoLogo = { src: '/demo-logos/tut.svg', backing: 'light' };
const UCT: DemoLogo = { src: '/demo-logos/uct.svg', backing: 'dark' };
const UKZN: DemoLogo = { src: '/demo-logos/ukzn.png', backing: 'light' };
/** UJ News's page header logo: https://news.uj.ac.za/wp-content/uploads/2025/05/UJ_Logo.png */
const UJ: DemoLogo = { src: '/demo-logos/uj.png', backing: 'light' };
/** UP Repository's header logo: https://repository.up.ac.za/assets/up/images/horizontal-logo-bg.webp */
const UP: DemoLogo = { src: '/demo-logos/up.webp', backing: 'light' };

/** By the short name and the full name, as views carry either. */
export const DEMO_UNIVERSITY_LOGOS: Readonly<Record<string, DemoLogo>> = {
  Wits: WITS,
  'University of the Witwatersrand': WITS,
  TUT,
  'Tshwane University of Technology': TUT,
  UCT,
  'University of Cape Town': UCT,
  UKZN,
  'University of KwaZulu-Natal': UKZN,
  UJ,
  'University of Johannesburg': UJ,
  UP,
  'University of Pretoria': UP,
};

/**
 * The judge demo's public TVET college logos (planning.md §19.1; the hackathon exception only, as
 * above), by college id. Each is the college's own file from its own website (the URL above each
 * entry), downloaded 2026-10-24 and only resized (at most 256 px, 30 KB, WebP; an SVG as it is).
 * Left out: logos printed as one banner with DHET's crest and the national coat of arms (not the
 * college's alone), one site whose "logo" was another college's, and one we couldn't confirm as the
 * college's. docs/deploy/demo.md lists every file and its source. **Remove after the hackathon.**
 */
export const DEMO_COLLEGE_LOGOS: Readonly<Record<string, DemoLogo>> = {
  /** https://emcol.co.za/wp-content/uploads/2025/12/New-logo-2025-e1765200894105.png */
  'east-cape-midlands': { src: '/demo-logos/colleges/east-cape-midlands.webp', backing: 'light' },
  /** https://www.ingwecollege.edu.za/logos/ingwe_logo.jpg */
  ingwe: { src: '/demo-logos/colleges/ingwe.webp', backing: 'light' },
  /** https://www.khc.edu.za/wp-content/uploads/2022/11/khc-logo.png */
  'king-hintsa': { src: '/demo-logos/colleges/king-hintsa.webp', backing: 'light' },
  /** https://www.pecollege.edu.za/wp-content/uploads/2024/09/rgb_horizontal-01-01-01-300x97.png */
  'port-elizabeth': { src: '/demo-logos/colleges/port-elizabeth.webp', backing: 'light' },
  /** https://flaviusmareka.net/wp-content/uploads/2018/12/flavius-slider-logo-1.png */
  'flavius-mareka': { src: '/demo-logos/colleges/flavius-mareka.webp', backing: 'light' },
  /** https://www.malutitvet.co.za/assets/img/logo.png */
  maluti: { src: '/demo-logos/colleges/maluti.webp', backing: 'light' },
  /** https://www.ncutvet.edu.za/wp-content/uploads/2024/06/Full-colour-logo-PNG-1024x427.png */
  'northern-cape-urban': { src: '/demo-logos/colleges/northern-cape-urban.webp', backing: 'light' },
  /** https://vuselelacollege.co.za/wp-content/uploads/2023/03/vuselela_logo-c-300x115.png */
  vuselela: { src: '/demo-logos/colleges/vuselela.webp', backing: 'light' },
  /** https://cjc.edu.za/wp-content/uploads/2022/06/cjc-logo.png */
  'central-johannesburg': {
    src: '/demo-logos/colleges/central-johannesburg.webp',
    backing: 'light',
  },
  /** https://eec.edu.za/wp-content/uploads/2021/06/eec-LOGO.png */
  'ekurhuleni-east': { src: '/demo-logos/colleges/ekurhuleni-east.webp', backing: 'light' },
  /** https://www.ewc.edu.za/images/ewc-logo.JPG */
  'ekurhuleni-west': { src: '/demo-logos/colleges/ekurhuleni-west.webp', backing: 'light' },
  /** https://www.swgc.co.za/wp-content/uploads/2022/08/Screenshot-2022-07-01-at-00.31.53.png */
  'south-west-gauteng': { src: '/demo-logos/colleges/south-west-gauteng.webp', backing: 'light' },
  /** https://tnc.edu.za/images/tnc-logo.webp */
  'tshwane-north': { src: '/demo-logos/colleges/tshwane-north.webp', backing: 'light' },
  /** https://www.coastalkzn.co.za/images/ckzn_logo.png */
  coastal: { src: '/demo-logos/colleges/coastal.webp', backing: 'light' },
  /** https://www.elangeni.edu.za/wp-content/uploads/2024/05/Elangeni-logo-Colour-Vector.png */
  elangeni: { src: '/demo-logos/colleges/elangeni.webp', backing: 'light' },
  /** https://www.majuba.edu.za/wp-content/uploads/2022/06/cropped-majuba-logo-270x270.png */
  majuba: { src: '/demo-logos/colleges/majuba.webp', backing: 'light' },
  /** https://www.mnambithicollege.co.za/images/mnambithi.png */
  mnambithi: { src: '/demo-logos/colleges/mnambithi.webp', backing: 'light' },
  /** https://www.mthashanacollege.co.za/wp-content/uploads/2025/07/logo-1-1.png */
  mthashana: { src: '/demo-logos/colleges/mthashana.webp', backing: 'light' },
  /** https://www.thekwini.edu.za/sitepad-data/uploads/2021/08/0001-1.jpeg */
  thekwini: { src: '/demo-logos/colleges/thekwini.webp', backing: 'light' },
  /** https://umfolozicollege.co.za/wp-content/uploads/2023/08/Umfolozi-TVET-College-Logo-May-2023-B.png */
  umfolozi: { src: '/demo-logos/colleges/umfolozi.webp', backing: 'light' },
  /** https://capricorncollege.edu.za/wp-content/uploads/2021/12/capricornTVETlogo.png */
  capricorn: { src: '/demo-logos/colleges/capricorn.webp', backing: 'light' },
  /** https://www.letcol.co.za/images/newLogo.png */
  letaba: { src: '/demo-logos/colleges/letaba.webp', backing: 'light' },
  /** https://mopanicollege.edu.za/wp-content/uploads/2019/12/MOPANI-LOGO.png */
  'mopani-south-east': { src: '/demo-logos/colleges/mopani-south-east.webp', backing: 'light' },
  /** https://www.vhembecollege.edu.za/wp-content/uploads/2018/11/cropped-logo_cut.jpg */
  vhembe: { src: '/demo-logos/colleges/vhembe.webp', backing: 'light' },
  /** https://www.waterbergcollege.co.za/admin/images/main_logo.png */
  waterberg: { src: '/demo-logos/colleges/waterberg.webp', backing: 'light' },
  /** https://gscollege.edu.za/wp-content/uploads/2024/11/Logo-right.png */
  'gert-sibande': { src: '/demo-logos/colleges/gert-sibande.webp', backing: 'light' },
  /** https://www.ntc.edu.za/images/logo.png */
  nkangala: { src: '/demo-logos/colleges/nkangala.webp', backing: 'light' },
  /** https://bolandcollege.com/wp-content/uploads/2022/11/Boland-Logo.png */
  boland: { src: '/demo-logos/colleges/boland.webp', backing: 'light' },
  /** https://falsebaycollege.co.za/wp-content/uploads/2021/01/fbc-logo.svg */
  'false-bay': { src: '/demo-logos/colleges/false-bay.svg', backing: 'light' },
  /** https://www.northlink.co.za/wp-content/uploads/2020/05/northlinklogo.png */
  northlink: { src: '/demo-logos/colleges/northlink.webp', backing: 'light' },
  /** https://sccollege.co.za/wp-content/uploads/2022/04/SCC-Vertical-Logo.png */
  'south-cape': { src: '/demo-logos/colleges/south-cape.webp', backing: 'light' },
};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Read with a dot: Next inlines only `process.env.NEXT_PUBLIC_…` written out in full. */
      readonly NEXT_PUBLIC_UF_DEMO_LOGOS?: string;
    }
  }
}

/** The demo's switch, read literally so Next inlines it into every bundle. */
export const DEMO_LOGOS_ON = process.env.NEXT_PUBLIC_UF_DEMO_LOGOS === '1';
