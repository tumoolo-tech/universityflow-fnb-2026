/**
 * The judge demo's university logos: the owner's decision of 2026-10-23, for the FNB hackathon
 * only, set aside option A (docs/brand/logo-permissions.md) for the demo. **Remove after the
 * hackathon**, or once each university has answered: then a real `logoPermission` takes over.
 *
 * Shown only when the demo's own build sets `NEXT_PUBLIC_UF_DEMO_LOGOS=1` (inlined at build time,
 * so client components see it too); production and staging refuse that variable (config.ts), and
 * the banner then says the logos are for the demo only, with no affiliation (`en.demo.logosNotice`).
 * The files are each university's own, downloaded from its website on 2026-10-23 into
 * `apps/web/public/demo-logos/`, unaltered except UKZN's: a 1,683 px, 110 KB PNG, resized to a
 * 96 px WebP for the chip it sits on (audit A4-22, 2026-10-25). UJ and UP followed on 2026-10-24
 * (their main sites refuse automated visitors, so each came from another of the university's own
 * sites; sources below). No university has granted a `logoPermission`: these show only under the
 * demo exception.
 *
 * Each logo carries its file's width and height (apps/web/test/demo-logo-sizes.test.ts holds them
 * to the file), so the chip has its shape before the file arrives and the page never shifts.
 */

export interface DemoLogo {
  /** Served from our own origin. */
  readonly src: string;
  /** The chip behind it: `light` for dark artwork, `dark` for white artwork, so both show. */
  readonly backing: 'light' | 'dark';
  /** The file's own size in pixels, for the `img`'s `width` and `height` (A4-22). */
  readonly width: number;
  readonly height: number;
}

const WITS: DemoLogo = { src: '/demo-logos/wits.svg', backing: 'light', width: 248, height: 88 };
const TUT: DemoLogo = { src: '/demo-logos/tut.svg', backing: 'light', width: 3217, height: 1105 };
const UCT: DemoLogo = { src: '/demo-logos/uct.svg', backing: 'dark', width: 300, height: 44 };
const UKZN: DemoLogo = { src: '/demo-logos/ukzn.webp', backing: 'light', width: 281, height: 96 };
/** UJ News's page header logo: https://news.uj.ac.za/wp-content/uploads/2025/05/UJ_Logo.png */
const UJ: DemoLogo = { src: '/demo-logos/uj.png', backing: 'light', width: 256, height: 256 };
/** UP Repository's header logo: https://repository.up.ac.za/assets/up/images/horizontal-logo-bg.webp */
const UP: DemoLogo = { src: '/demo-logos/up.webp', backing: 'light', width: 468, height: 152 };

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

/** A college's or a funder's logo file, with its size. */
const logo = (src: string, width: number, height: number): DemoLogo => ({
  src,
  backing: 'light',
  width,
  height,
});

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
  'east-cape-midlands': logo('/demo-logos/colleges/east-cape-midlands.webp', 256, 129),
  /** https://www.ingwecollege.edu.za/logos/ingwe_logo.jpg */
  ingwe: logo('/demo-logos/colleges/ingwe.webp', 150, 91),
  /** https://www.khc.edu.za/wp-content/uploads/2022/11/khc-logo.png */
  'king-hintsa': logo('/demo-logos/colleges/king-hintsa.webp', 247, 173),
  /** https://www.pecollege.edu.za/wp-content/uploads/2024/09/rgb_horizontal-01-01-01-300x97.png */
  'port-elizabeth': logo('/demo-logos/colleges/port-elizabeth.webp', 256, 83),
  /** https://flaviusmareka.net/wp-content/uploads/2018/12/flavius-slider-logo-1.png */
  'flavius-mareka': logo('/demo-logos/colleges/flavius-mareka.webp', 224, 105),
  /** https://www.malutitvet.co.za/assets/img/logo.png */
  maluti: logo('/demo-logos/colleges/maluti.webp', 256, 248),
  /** https://www.ncutvet.edu.za/wp-content/uploads/2024/06/Full-colour-logo-PNG-1024x427.png */
  'northern-cape-urban': logo('/demo-logos/colleges/northern-cape-urban.webp', 256, 107),
  /** https://vuselelacollege.co.za/wp-content/uploads/2023/03/vuselela_logo-c-300x115.png */
  vuselela: logo('/demo-logos/colleges/vuselela.webp', 256, 98),
  /** https://cjc.edu.za/wp-content/uploads/2022/06/cjc-logo.png */
  'central-johannesburg': logo('/demo-logos/colleges/central-johannesburg.webp', 256, 176),
  /** https://eec.edu.za/wp-content/uploads/2021/06/eec-LOGO.png */
  'ekurhuleni-east': logo('/demo-logos/colleges/ekurhuleni-east.webp', 256, 85),
  /** https://www.ewc.edu.za/images/ewc-logo.JPG */
  'ekurhuleni-west': logo('/demo-logos/colleges/ekurhuleni-west.webp', 256, 134),
  /** https://www.swgc.co.za/wp-content/uploads/2022/08/Screenshot-2022-07-01-at-00.31.53.png */
  'south-west-gauteng': logo('/demo-logos/colleges/south-west-gauteng.webp', 256, 118),
  /** https://tnc.edu.za/images/tnc-logo.webp */
  'tshwane-north': logo('/demo-logos/colleges/tshwane-north.webp', 256, 134),
  /** https://www.coastalkzn.co.za/images/ckzn_logo.png */
  coastal: logo('/demo-logos/colleges/coastal.webp', 207, 113),
  /** https://www.elangeni.edu.za/wp-content/uploads/2024/05/Elangeni-logo-Colour-Vector.png */
  elangeni: logo('/demo-logos/colleges/elangeni.webp', 256, 125),
  /** https://www.majuba.edu.za/wp-content/uploads/2022/06/cropped-majuba-logo-270x270.png */
  majuba: logo('/demo-logos/colleges/majuba.webp', 256, 256),
  /** https://www.mnambithicollege.co.za/images/mnambithi.png */
  mnambithi: logo('/demo-logos/colleges/mnambithi.webp', 93, 70),
  /** https://www.mthashanacollege.co.za/wp-content/uploads/2025/07/logo-1-1.png */
  mthashana: logo('/demo-logos/colleges/mthashana.webp', 256, 106),
  /** https://www.thekwini.edu.za/sitepad-data/uploads/2021/08/0001-1.jpeg */
  thekwini: logo('/demo-logos/colleges/thekwini.webp', 256, 105),
  /** https://umfolozicollege.co.za/wp-content/uploads/2023/08/Umfolozi-TVET-College-Logo-May-2023-B.png */
  umfolozi: logo('/demo-logos/colleges/umfolozi.webp', 256, 236),
  /** https://capricorncollege.edu.za/wp-content/uploads/2021/12/capricornTVETlogo.png */
  capricorn: logo('/demo-logos/colleges/capricorn.webp', 184, 256),
  /** https://www.letcol.co.za/images/newLogo.png */
  letaba: logo('/demo-logos/colleges/letaba.webp', 256, 105),
  /** https://mopanicollege.edu.za/wp-content/uploads/2019/12/MOPANI-LOGO.png */
  'mopani-south-east': logo('/demo-logos/colleges/mopani-south-east.webp', 256, 122),
  /** https://www.vhembecollege.edu.za/wp-content/uploads/2018/11/cropped-logo_cut.jpg */
  vhembe: logo('/demo-logos/colleges/vhembe.webp', 256, 224),
  /** https://www.waterbergcollege.co.za/admin/images/main_logo.png */
  waterberg: logo('/demo-logos/colleges/waterberg.webp', 256, 64),
  /** https://gscollege.edu.za/wp-content/uploads/2024/11/Logo-right.png */
  'gert-sibande': logo('/demo-logos/colleges/gert-sibande.webp', 250, 109),
  /** https://www.ntc.edu.za/images/logo.png */
  nkangala: logo('/demo-logos/colleges/nkangala.webp', 256, 89),
  /** https://bolandcollege.com/wp-content/uploads/2022/11/Boland-Logo.png */
  boland: logo('/demo-logos/colleges/boland.webp', 219, 181),
  /** https://falsebaycollege.co.za/wp-content/uploads/2021/01/fbc-logo.svg */
  'false-bay': logo('/demo-logos/colleges/false-bay.svg', 294, 98),
  /** https://www.northlink.co.za/wp-content/uploads/2020/05/northlinklogo.png */
  northlink: logo('/demo-logos/colleges/northlink.webp', 256, 48),
  /** https://sccollege.co.za/wp-content/uploads/2022/04/SCC-Vertical-Logo.png */
  'south-cape': logo('/demo-logos/colleges/south-cape.webp', 256, 244),
};

/**
 * The judge demo's bursary funders' logos (the owner, 2026-10-25: "add … bursaries … with their
 * official logos"; the hackathon exception only, as above), by bursary id. Each is the funder's own
 * file from its own website (the URL above each entry), downloaded 2026-10-25; a raster one only
 * resized (at most 256 px, 30 KB, WebP), an SVG as it is. Left out: Funza Lushaka (its site's
 * header is one banner with the Department's coat of arms and photographs, not the bursary's logo
 * alone), and the FirstRand Empowerment Foundation, Investec and the Old Mutual Imfundo Trust (no
 * logo of their own could be read on their own sites). **Remove after the hackathon.**
 */
export const DEMO_FUNDER_LOGOS: Readonly<Record<string, DemoLogo>> = {
  /** https://www.isfap.org.za/assets/isfap-logo-BunfIPxh.png */
  isfap: logo('/demo-logos/funders/isfap.webp', 256, 139),
  /** https://saicawebprstorage.blob.core.windows.net/uploads/Logos/Thuthuka-logo-orange.jpg (SAICA's page) */
  thuthuka: logo('/demo-logos/funders/thuthuka.webp', 256, 253),
  /** https://www.sasol.com/sites/default/files/sasol-new-logo_0.png */
  sasol: logo('/demo-logos/funders/sasol.webp', 229, 86),
  /** https://allangrayorbis.org/wp-content/uploads/2023/09/Agof-Logo.svg */
  'allan-gray-orbis': logo('/demo-logos/funders/allan-gray-orbis.svg', 167, 53),
  /** The inline SVG logo (class "moshal-logo") in the header of https://www.moshalprogram.org.za/ */
  moshal: logo('/demo-logos/funders/moshal.svg', 185, 34),
  /** https://group.nedbank.co.za/content/dam/nedbank/logo/NEDBANK.svg */
  nedbank: logo('/demo-logos/funders/nedbank.svg', 100, 14),
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
