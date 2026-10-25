import { profilePhoto as t } from '@universityflow/content/app';
import {
  CENTRED_CROP,
  cropBox,
  cropView,
  MAX_ZOOM,
  MIN_ZOOM,
  moveCrop,
  type PhotoCrop,
  zoomCrop,
} from '@universityflow/ui';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ApiError, errorMessage } from '../lib/api';
import {
  chooseProfilePhoto,
  type PickedPhoto,
  removeProfilePhoto,
  takeProfilePhoto,
  uploadProfilePhoto,
} from '../lib/photo';
import { theme } from '../lib/theme';
import { deleteIfOurs } from '../lib/upload';
import { announce, Button, Notice } from './ui';

/**
 * The profile photo in the app's "Make it yours" (profile-look-proposal §5.3): only when the
 * server's switch is on (the screen passes no `version` prop otherwise). Take or choose a photo,
 * then crop it to a square with buttons a screen reader and a switch can use (zoom in and out,
 * move left, right, up and down); the server applies the crop. Nothing moves on its own.
 */

type Refusal = keyof typeof t.errors;

function photoError(error: unknown): string {
  // The learner's consent doesn't name the photo yet (A11-31, migration 0037).
  if (error instanceof ApiError && error.detail === 'photo-consent') return t.consentNeeded;
  if (error instanceof ApiError && error.code === 'upload' && error.detail) {
    if (Object.hasOwn(t.errors, error.detail)) return t.errors[error.detail as Refusal];
  }
  return errorMessage(error);
}

/**
 * The crop's window on the screen: a square at most this wide, narrower on a narrow screen (a
 * 320pt iPhone SE, or Display Zoom), where a fixed size ran past the edge (A2-37). The photo
 * inside is placed in percentages of it (`cropView`), so it fits whatever the window's size.
 */
const VIEWPORT = theme.space['8'] * 5;

export function ProfilePhotoSection({
  version,
  onChange,
}: {
  version: string | null;
  onChange: (version: string | null) => void;
}) {
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>(CENTRED_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    try {
      const result = source === 'camera' ? await takeProfilePhoto() : await chooseProfilePhoto();
      if (result === 'denied') {
        setError(t.cameraDenied);
        return;
      }
      if (!result) return;
      setCrop(CENTRED_CROP);
      setPicked(result);
    } catch (e) {
      setError(photoError(e));
    }
  }

  function cancel() {
    if (picked) deleteIfOurs(picked.uri);
    setPicked(null);
    setError(null);
  }

  async function save() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await uploadProfilePhoto(picked, cropBox(crop, picked.width, picked.height));
      setPicked(null);
      onChange(next);
      announce(t.saved);
    } catch (e) {
      setError(photoError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeProfilePhoto();
      onChange(null);
      announce(t.removed);
    } catch (e) {
      setError(photoError(e));
    } finally {
      setBusy(false);
    }
  }

  const w = picked?.width ?? 1;
  const h = picked?.height ?? 1;
  const zoom = (steps: number) => setCrop((c) => zoomCrop(c, steps, w, h));
  const move = (dx: number, dy: number) => setCrop((c) => moveCrop(c, dx, dy, w, h));
  const view = picked ? cropView(crop, w, h) : null;

  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[theme.text.label, { color: theme.color.ink }]}>
        {t.heading}
      </Text>
      <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>{t.lead}</Text>
      {/* Only the learner sees it, used for nothing else (A11-31). */}
      <Text style={[theme.text.small, { color: theme.color.ink }]}>{t.onlyYou}</Text>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {picked && view ? (
        <View style={styles.group}>
          <Text style={[theme.text.label, { color: theme.color.ink }]}>{t.cropTitle}</Text>
          <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>{t.cropLead}</Text>
          <View
            testID="photo-crop"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.viewport}
          >
            <Image
              testID="photo-crop-image"
              source={{ uri: picked.uri }}
              style={{
                position: 'absolute',
                width: `${view.width}%`,
                height: `${view.height}%`,
                left: `${view.left}%`,
                top: `${view.top}%`,
              }}
            />
            <View style={styles.ring} />
          </View>
          <View style={styles.row}>
            <Button
              label={t.zoomOut}
              variant="secondary"
              disabled={crop.zoom <= MIN_ZOOM}
              onPress={() => zoom(-1)}
            />
            <Button
              label={t.zoomIn}
              variant="secondary"
              disabled={crop.zoom >= MAX_ZOOM}
              onPress={() => zoom(1)}
            />
          </View>
          <View style={styles.row}>
            <Button label={t.moveLeft} variant="secondary" onPress={() => move(-1, 0)} />
            <Button label={t.moveRight} variant="secondary" onPress={() => move(1, 0)} />
            <Button label={t.moveUp} variant="secondary" onPress={() => move(0, -1)} />
            <Button label={t.moveDown} variant="secondary" onPress={() => move(0, 1)} />
          </View>
          <Button label={t.save} busy={busy} busyLabel={t.saving} onPress={() => void save()} />
          <Button label={t.cancel} variant="quiet" onPress={cancel} />
        </View>
      ) : (
        <View style={styles.group}>
          <Button label={t.takePhoto} variant="secondary" onPress={() => void pick('camera')} />
          <Button
            label={t.chooseFromPhone}
            variant="secondary"
            onPress={() => void pick('library')}
          />
          {version ? (
            <Button label={t.remove} variant="quiet" busy={busy} onPress={() => void remove()} />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.space['2'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  viewport: {
    width: '100%',
    maxWidth: VIEWPORT,
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceSunk,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    borderColor: theme.color.ink,
    borderStyle: 'dashed',
  },
});
