import type { CollegeRecords } from '../../colleges';
import { easternCapeColleges, easternCapeProgrammes } from './eastern-cape';
import {
  freeStateNorthernCapeNorthWestColleges,
  freeStateNorthernCapeNorthWestProgrammes,
} from './fs-nc-nw';
import { gautengColleges, gautengProgrammes } from './gauteng';
import { kwazuluNatalColleges, kwazuluNatalProgrammes } from './kwazulu-natal';
import { limpopoMpumalangaColleges, limpopoMpumalangaProgrammes } from './limpopo-mpumalanga';
import { teachOutNotices } from './register';
import { westernCapeColleges, westernCapeProgrammes } from './western-cape';

export { DHET_COLLEGE_LIST } from './register';

/** Every public TVET college record, drafts included (the owner's decision of 2026-10-24). */
export const COLLEGE_RECORDS: CollegeRecords = {
  colleges: [
    ...easternCapeColleges,
    ...freeStateNorthernCapeNorthWestColleges,
    ...gautengColleges,
    ...kwazuluNatalColleges,
    ...limpopoMpumalangaColleges,
    ...westernCapeColleges,
  ],
  programmes: [
    ...easternCapeProgrammes,
    ...freeStateNorthernCapeNorthWestProgrammes,
    ...gautengProgrammes,
    ...kwazuluNatalProgrammes,
    ...limpopoMpumalangaProgrammes,
    ...westernCapeProgrammes,
  ],
  notices: teachOutNotices,
};
