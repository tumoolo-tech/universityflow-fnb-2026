import { documentErrors } from './document-errors';

/** `en.documents`. */
export const documents = {
  title: 'Documents',
  lead: 'Your uploads are private: only you can see them. Delete them any time.',
  uploadReport: 'Upload my report',
  uploadLead:
    'Take a clear photo of the page with your marks, in good light, or upload a PDF. JPG, PNG, WebP or PDF, up to 10 MB.',
  chooseFile: 'Choose a photo or PDF',
  takePhoto: 'Take a photo',
  uploading: 'Uploading…',
  reading: 'Reading your report…',
  kind: 'Which report is this?',
  empty: 'No documents yet.',
  delete: 'Delete',
  deleted: 'Deleted.',
  statuses: {
    uploaded: 'Uploaded',
    extracted: 'Waiting for you to check',
    confirmed: 'Checked by you',
    failed: 'Couldn’t be read',
  },
  choosePhoto: 'Choose a photo',
  choosePdf: 'Choose a PDF',
  typeMarks: 'Type my marks in instead',
  appLead:
    'Take a clear photo of the page with your marks, in good light, or choose a photo or PDF you already have. The photo is deleted from this phone once it’s uploaded.',
  cameraDenied:
    'UniversityFlow can’t use the camera. You can allow it in your phone’s settings, or choose a photo or PDF instead.',
  errors: documentErrors,
} as const;
