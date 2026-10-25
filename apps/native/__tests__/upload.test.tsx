import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { REPORT_KINDS } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { contrastRatio, tokens } from '@universityflow/tokens';
import { fetch } from 'expo/fetch';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import UploadScreen from '../app/upload';
import { ConfirmMarks } from '../components/confirm-marks';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import type { UploadResult } from '../lib/types';
import { deleteIfOurs, multipart } from '../lib/upload';
import { type Call, serve } from '../test-utils/fake-api';
import { me } from '../test-utils/fixtures';
import { CACHE, documentPicker, files, imagePicker } from '../test-utils/native-modules';

/** The bytes of a tiny JPEG (its magic number is all the server's check looks at first). */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 9, 9]);
const PHOTO = `${CACHE}ImagePicker/photo-1.jpg`;
const DOCUMENT = `${CACHE}DocumentPicker/report.pdf`;

const draft: UploadResult = {
  documentId: '11111111-1111-4111-8111-111111111111',
  sample: false,
  draft: {
    rows: [
      { nameAsPrinted: 'Maths', subject: 'mathematics', percent: 64, issue: null },
      { nameAsPrinted: 'Eng HL', subject: 'english-hl', percent: 71, issue: null },
    ],
    warnings: [],
  },
};

const TICKET = {
  uploadId: '22222222-2222-4222-8222-222222222222',
  url: 'https://uf-documents.s3.af-south-1.amazonaws.com/',
  fields: { key: 'documents/incoming-abc', policy: 'cG9saWN5', 'x-amz-signature': 'sig' },
  expiresAt: '2026-10-13T08:05:00Z',
};

/** Bytes as one character each (latin1), to read a multipart body. */
const text = (bytes: Uint8Array | null) => {
  let out = '';
  for (const b of bytes ?? []) out += String.fromCharCode(b);
  return out;
};

/**
 * The requests that move the report. The screen also reads the learner's grade when it opens
 * (`GET /api/me`, G10-1: the confirm form starts on that grade's report); that sends nothing.
 */
const uploads = (calls: Call[]) => calls.filter((c) => c.key !== 'GET /api/me');

function camera(uri = PHOTO, bytes = JPEG) {
  files.set(uri, bytes);
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri, mimeType: 'image/jpeg', width: 10, height: 10 }],
  });
}

beforeEach(async () => {
  await saveToken('tok');
});

describe('camera upload of a report', () => {
  it('asks for the camera only on "Take a photo"', async () => {
    serve({});
    const screen = await render(<UploadScreen />);
    expect(imagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
    expect(imagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    // Refused: the camera never opens, and the learner hears what else they can do.
    expect(imagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(await screen.findByText(en.documents.cameraDenied)).toBeTruthy();
  });

  it('says the refusal out loud, on iOS too (A3-02)', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    try {
      serve({});
      const screen = await render(<UploadScreen />);
      await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
      await screen.findByText(en.documents.cameraDenied);
      expect(announce).toHaveBeenCalledWith(en.documents.cameraDenied);
    } finally {
      announce.mockRestore();
    }
  });

  it('uploads straight to storage when the server offers a ticket, then deletes the photo', async () => {
    camera();
    const all = serve({
      'POST /api/documents/uploads': { json: TICKET },
      'POST /': { status: 204 },
      [`POST /api/documents/uploads/${TICKET.uploadId}`]: { json: draft },
    });
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(en.confirm.title)).toBeTruthy();

    const calls = uploads(all);
    expect(calls.map((c) => c.key)).toEqual([
      'POST /api/documents/uploads',
      'POST /',
      `POST /api/documents/uploads/${TICKET.uploadId}`,
    ]);
    expect(calls[0]?.body).toEqual({ contentType: 'image/jpeg', size: JPEG.length });
    // Storage gets the ticket's fields, then the file last, and never our session.
    const s3 = calls[1] as Call;
    expect(s3.url).toBe(TICKET.url);
    expect(s3.headers['authorization']).toBeUndefined();
    expect(s3.headers['x-uf-client']).toBeUndefined();
    expect(s3.credentials).toBe('omit');
    const body = text(s3.bytes);
    expect(body.indexOf('name="key"')).toBeLessThan(body.indexOf('name="file"'));
    expect(body).toContain('documents/incoming-abc');
    expect(body).toContain('filename="report.jpg"');
    expect(body.endsWith('--\r\n')).toBe(true);
    // The photo is gone from the phone.
    expect(files.has(PHOTO)).toBe(false);
  });

  it('falls back to a multipart upload through our server, with a length, when there is no ticket', async () => {
    files.set(DOCUMENT, PDF);
    documentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: DOCUMENT, mimeType: 'application/pdf', name: 'Thandi report.pdf' }],
    });
    const calls = serve({
      'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
      'POST /api/documents': { json: draft },
    });
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.choosePdf }));
    expect(await screen.findByText(en.confirm.title)).toBeTruthy();
    const upload = calls.find((c) => c.key === 'POST /api/documents') as Call;
    expect(upload.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(upload.headers['authorization']).toBe('Bearer tok');
    expect(upload.bytes?.length).toBeGreaterThan(PDF.length);
    // The learner's own file name never leaves the phone (it can say who they are).
    expect(text(upload.bytes)).toContain('filename="report.pdf"');
    expect(text(upload.bytes)).not.toContain('Thandi');
    expect(files.has(DOCUMENT)).toBe(false);
  });

  it('deletes the photo even when the upload fails, and says why', async () => {
    camera();
    serve({
      'POST /api/documents/uploads': { json: TICKET },
      'POST /': { status: 403 },
    });
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(en.documents.errors['not-received'])).toBeTruthy();
    expect(files.has(PHOTO)).toBe(false);
  });

  it('refuses a type or size the server would refuse, before any upload', async () => {
    const big = `${CACHE}ImagePicker/big.jpg`;
    files.set(big, new Uint8Array(10 * 1024 * 1024 + 1));
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: big, mimeType: 'image/jpeg' }],
    });
    const calls = serve({});
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.choosePhoto }));
    expect(await screen.findByText(en.documents.errors['too-large'])).toBeTruthy();

    const heic = `${CACHE}ImagePicker/photo.heic`;
    files.set(heic, JPEG);
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: heic, mimeType: 'image/heic' }],
    });
    await fireEvent.press(screen.getByRole('button', { name: en.documents.choosePhoto }));
    expect(await screen.findByText(en.documents.errors['unsupported-type'])).toBeTruthy();
    expect(uploads(calls)).toHaveLength(0);
    expect(files.has(big) || files.has(heic)).toBe(false);
  });

  it('never deletes a file outside the app’s own cache', () => {
    const gallery = 'file:///storage/emulated/0/DCIM/photo.jpg';
    files.set(gallery, JPEG);
    expect(deleteIfOurs(gallery)).toBe(false);
    expect(files.has(gallery)).toBe(true);
    expect(deleteIfOurs(`${CACHE}../outside.jpg`.replace('/cache/../', '/'))).toBe(false);
    expect(deleteIfOurs(`${CACHE}missing.jpg`)).toBe(false);
  });

  it('builds a multipart body the way S3 and our server read it', () => {
    const { body, contentType } = multipart(
      { a: '1' },
      { bytes: JPEG, mimeType: 'image/jpeg', name: 'report.jpg' },
      'B',
    );
    expect(contentType).toBe('multipart/form-data; boundary=B');
    expect(text(body)).toBe(
      `--B\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n` +
        `--B\r\nContent-Disposition: form-data; name="file"; filename="report.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n${text(JPEG)}\r\n--B--\r\n`,
    );
  });
});

describe('confirming the marks read from the photo (hard rule 6)', () => {
  async function uploaded() {
    camera();
    const calls = serve({
      'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
      'POST /api/documents': { json: draft },
      'POST /api/reports': { json: { reportId: 'r1', recheck: 'not-a-recheck' } },
    });
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(en.confirm.title);
    return { calls, screen };
  }

  it('uses nothing until the learner confirms, then saves exactly the rows they checked', async () => {
    const { calls, screen } = await uploaded();
    // Read, shown, and not used: no report saved, results untouched.
    expect(calls.some((c) => c.key === 'POST /api/reports')).toBe(false);
    expect(screen.getByText(en.confirm.asPrinted('Maths'))).toBeTruthy();
    expect(screen.getByTestId('percent-0').props.value).toBe('64');

    // The learner fixes a mark the reader got wrong, and picks the report type.
    await fireEvent.changeText(screen.getByTestId('percent-0'), '68');
    await fireEvent.press(screen.getByRole('radio', { name: en.reportKinds['grade-12-june'] }));
    expect(calls.some((c) => c.key === 'POST /api/reports')).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: en.confirm.confirm }));
    const saved = calls.find((c) => c.key === 'POST /api/reports');
    expect(saved?.body).toEqual({
      kind: 'grade-12-june',
      documentId: draft.documentId,
      marks: [
        { subject: 'mathematics', percent: 68 },
        { subject: 'english-hl', percent: 71 },
      ],
    });
    expect(useRouter().replace).toHaveBeenCalledWith('/results');
  });

  it('refuses to confirm a row with no subject, a mark over 100, or a subject twice', async () => {
    const { calls, screen } = await uploaded();
    await fireEvent.changeText(screen.getByTestId('percent-1'), '120');
    await fireEvent.press(screen.getByRole('button', { name: en.confirm.confirm }));
    expect(await screen.findByText(en.confirm.errors.invalid)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('percent-1'), '70');
    // Change the second row's subject to Mathematics: now it appears twice.
    await fireEvent.press(screen.getByTestId('subject-1'));
    await fireEvent.changeText(screen.getByTestId('subject-search-1'), 'mathematics');
    const row = within(screen.getByTestId('mark-row-1'));
    await fireEvent.press(row.getByRole('button', { name: 'Mathematics' }));
    await fireEvent.press(screen.getByRole('button', { name: en.confirm.confirm }));
    expect(await screen.findByText(en.confirm.errors.duplicate)).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/reports')).toBe(false);

    // Removing the duplicate row makes it valid.
    await fireEvent.press(row.getByRole('button', { name: en.common.remove }));
    await fireEvent.press(screen.getByRole('button', { name: en.confirm.confirm }));
    expect(calls.find((c) => c.key === 'POST /api/reports')?.body).toMatchObject({
      marks: [{ subject: 'mathematics', percent: 64 }],
    });
  });

  it('lets the learner type their marks in when the report could not be read', async () => {
    camera();
    serve({
      'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
      'POST /api/documents': { json: { documentId: draft.documentId, draft: null, sample: false } },
    });
    const screen = await render(<UploadScreen />);
    await fireEvent.press(screen.getByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(en.confirm.manualTitle)).toBeTruthy();
    expect(screen.getByText(en.documents.errors.unreadable)).toBeTruthy();

    const typed = await render(<UploadScreen />);
    // Ready once the grade has loaded (or failed to, A1-40).
    await waitFor(() =>
      expect(
        typed.getByRole('button', { name: en.documents.typeMarks }).props.accessibilityState
          ?.disabled,
      ).toBe(false),
    );
    await fireEvent.press(typed.getByRole('button', { name: en.documents.typeMarks }));
    expect(await typed.findByText(en.confirm.manualLead)).toBeTruthy();
    await fireEvent.press(typed.getByRole('button', { name: en.common.cancel }));
    expect(typed.getByRole('button', { name: en.documents.takePhoto })).toBeTruthy();
  });

  it('waits for the learner’s grade before the form opens, so it starts on their report (A1-40)', async () => {
    let answer: (value: unknown) => void = () => undefined;
    (fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const screen = await render(<UploadScreen />);
    const typeIn = () => screen.getByRole('button', { name: en.documents.typeMarks });
    // On a slow connection the grade isn't here yet: the form can't open on the wrong report.
    expect(typeIn().props.accessibilityState?.disabled).toBe(true);
    answer({ ok: true, status: 200, json: async () => me({}, true, 10) });
    await waitFor(() => expect(typeIn().props.accessibilityState?.disabled).toBe(false));
    await fireEvent.press(typeIn());
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.props.accessibilityState?.checked)
      .map((r) => r.props.accessibilityLabel);
    expect(checked).toEqual([en.reportKinds['grade-10-final']]);
  });
});

describe('the confirm form for a screen reader', () => {
  const misread = {
    rows: [
      { nameAsPrinted: 'Maths', subject: 'mathematics', percent: 140, issue: 'out-of-range' },
      { nameAsPrinted: '???', subject: null, percent: 71, issue: 'unknown-subject' },
    ],
    warnings: [],
  } as const;

  const DECEMBER = new Date('2026-12-02T08:00:00Z');
  const JANUARY = new Date('2027-01-08T08:00:00Z');

  const confirmMarks = (
    grade: number | null = null,
    options: { today?: Date; printedKind?: string | null } = {},
  ) =>
    render(
      <ConfirmMarks
        documentId={null}
        draft={{ rows: [...misread.rows], warnings: [], printedKind: options.printedKind ?? null }}
        sample={false}
        grade={grade}
        today={options.today ?? DECEMBER}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

  const checked = async (...args: Parameters<typeof confirmMarks>) => {
    const screen = await confirmMarks(...args);
    const labels = screen
      .getAllByRole('radio')
      .filter((r) => r.props.accessibilityState?.checked)
      .map((r) => r.props.accessibilityLabel);
    await screen.unmount();
    return labels;
  };

  it('starts on the learner’s own grade’s report: Grade 10’s for a Grade 10 learner (G10-1)', async () => {
    expect(await checked(10)).toEqual([en.reportKinds['grade-10-final']]);
    expect(await checked(11)).toEqual([en.reportKinds['grade-11-final']]);
    expect(await checked(null)).toEqual([en.reportKinds['grade-11-final']]);
  });

  it('starts on the report the document prints, else Grade 10’s for Grade 11 before December (A1-35)', async () => {
    expect(await checked(11, { today: JANUARY })).toEqual([en.reportKinds['grade-10-final']]);
    expect(await checked(11, { today: DECEMBER, printedKind: 'grade-10-final' })).toEqual([
      en.reportKinds['grade-10-final'],
    ]);
    expect(await checked(12, { today: JANUARY, printedKind: 'grade-12-june' })).toEqual([
      en.reportKinds['grade-12-june'],
    ]);
    // Anything the server sends that isn't a report kind is ignored. (Grade 11 June became a kind
    // with the school record, §18.7 C2: there is still no Grade 10 September kind.)
    expect(await checked(11, { today: DECEMBER, printedKind: 'grade-10-september' })).toEqual([
      en.reportKinds['grade-11-final'],
    ]);
    // A Grade 11 June report the document prints is now one: the form starts there.
    expect(await checked(11, { today: DECEMBER, printedKind: 'grade-11-june' })).toEqual([
      en.reportKinds['grade-11-june'],
    ]);
  });

  it('names each mark field by its subject, and puts the error where it is read (A3-03)', async () => {
    const screen = await confirmMarks();
    const maths = screen.getByLabelText(en.confirm.percentFor('Mathematics'));
    expect(maths.props.value).toBe('140');
    expect(maths.props.accessibilityHint).toContain(en.confirm.issues['out-of-range']);
    // A row with no subject yet is named by its place.
    expect(screen.getByLabelText(en.confirm.percentFor(en.confirm.subjectNumber(2)))).toBeTruthy();
    // RN 0.86 ignores aria-invalid: it is not how the error is exposed.
    expect(maths.props['aria-invalid']).toBeUndefined();
  });

  it('groups the report types under their question (A3-07)', async () => {
    const screen = await confirmMarks();
    // Not `getByRole`: a group must not be `accessible` (that would merge its radios into one
    // element on iOS), and RNTL only finds accessible elements by role.
    const group = screen.getByLabelText(en.documents.kind);
    expect(group.props.accessibilityRole).toBe('radiogroup');
    // Every report kind, from Grade 10's (G10-2).
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.props.accessibilityLabel),
    ).toEqual(REPORT_KINDS.map((k) => en.reportKinds[k]));
  });

  it('draws an unselected report type with a boundary that reads as a control (A2-04)', async () => {
    const screen = await confirmMarks();
    const unselected = screen.getByRole('radio', { name: en.reportKinds['grade-12-june'] });
    expect(unselected.props.accessibilityState).toMatchObject({ checked: false });
    // The control's boundary: the first non-transparent border in the radio.
    const borders: string[] = [];
    const walk = (node: { props: { style?: unknown }; children: unknown[] }) => {
      const style = StyleSheet.flatten(node.props.style as never) as { borderColor?: string };
      if (style?.borderColor && style.borderColor !== 'transparent')
        borders.push(style.borderColor);
      for (const child of node.children) if (typeof child === 'object') walk(child as never);
    };
    walk(unselected as never);
    expect(borders.length).toBeGreaterThan(0);
    expect(contrastRatio(borders[0] as string, theme.color.surface)).toBeGreaterThanOrEqual(
      tokens.contrast.nonText,
    );
  });
});
