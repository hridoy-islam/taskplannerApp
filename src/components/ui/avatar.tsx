import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

type AvatarProps = {
  name?: string;
  uri?: string;
  size?: number;
  /** Draws a ring around the avatar (e.g. for an active tab). */
  ring?: boolean;
};

export function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

/** Shows the user's image, falling back to initials when there's no image or it fails to load. */
export function Avatar({ name, uri, size = 40, ring = false }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  // Try again whenever the image changes.
  useEffect(() => setFailed(false), [uri]);

  return (
    <View className={ring ? 'rounded-full border-[1.5px] border-primary p-0.5' : ''}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={dimension}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessibilityLabel={name}
        />
      ) : (
        <View className="items-center justify-center bg-primary" style={dimension} accessibilityLabel={name}>
          <Text className="font-bold tracking-wide text-primary-foreground" style={{ fontSize: size * 0.38 }}>
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
}
