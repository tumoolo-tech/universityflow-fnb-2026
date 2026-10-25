import { en } from '@universityflow/content/app';
import { UNIVERSITY_LOGOS, UNIVERSITY_MARK_COLORS, universityMark } from '@universityflow/ui';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../lib/config';
import { theme } from '../lib/theme';

/**
 * The neutral university mark (the owner's decision, option A, 2026-10-23; packages/ui
 * university-mark.ts), as on the web: our letters on a grey tile, never the university's logo or
 * colours. Its logo shows only from `UNIVERSITY_LOGOS`, the catalogue's written permissions (none
 * today), loaded from the web app (`/logos/<id>.png`). Views and Text only.
 *
 * Beside the name it is decoration, hidden from the screen reader; `alone` names it by the
 * university instead.
 */
export function UniversityMark({
  name,
  alone = false,
  logos = UNIVERSITY_LOGOS,
}: {
  /** The university's short name, as the catalogue gives it ("Wits", "UJ"). */
  name: string;
  alone?: boolean;
  /** For tests only: the permitted logos (defaults to the catalogue's). */
  logos?: Readonly<Record<string, string>>;
}) {
  const { monogram, logo } = universityMark(name, logos);
  const a11y = alone
    ? {
        accessible: true,
        accessibilityRole: 'image' as const,
        accessibilityLabel: logo ? en.universityMark.logoAlt(name) : name,
      }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  if (logo) {
    return (
      <Image
        testID="university-logo"
        source={{ uri: `${apiUrl()}${logo}` }}
        style={styles.logo}
        resizeMode="contain"
        {...a11y}
      />
    );
  }
  return (
    <View testID="university-mark" style={styles.mark} {...a11y}>
      <Text style={styles.letters} numberOfLines={1}>
        {monogram}
      </Text>
    </View>
  );
}

/** A university's name (`children`) with its mark before it: for a badge, a row or a heading. */
export function WithUniversityMark({
  name,
  short,
  children,
}: {
  /** The name shown in `children`. */
  name: string;
  /** The short name the mark is drawn from, when `name` is the full one. */
  short?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <UniversityMark name={short || name} />
      <View style={styles.name}>{children}</View>
    </View>
  );
}

const { ground, ink, edge } = UNIVERSITY_MARK_COLORS;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] },
  name: { flexShrink: 1 },
  mark: {
    minWidth: theme.space['6'],
    paddingHorizontal: theme.space['1'],
    paddingVertical: theme.space['1'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.color[edge],
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color[ground],
  },
  letters: {
    ...theme.text.small,
    color: theme.color[ink],
    fontWeight: theme.fontWeight.bold,
  },
  logo: { width: theme.space['7'], height: theme.space['6'] },
});
