import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useNotice } from '../contexts/NoticeContext';
import { useI18n } from '../i18n';
import type { MemoryPost } from '../types/happened';

export function useSharePost() {
  const { showNotice } = useNotice();
  const { t } = useI18n();

  return useCallback(
    async (post: MemoryPost) => {
      const shareUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}?stage=app&screen=home&homePost=0`
          : 'https://happened.app';
      const shareText = `${post.authorName} at ${post.placeName}: ${post.caption}`;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Happened', text: shareText, url: shareUrl });
        showNotice(t('app.shareOpened'));
        return;
      }
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        showNotice(t('app.shareCopied'));
        return;
      }
      showNotice(t('app.shareUnavailable'));
    },
    [showNotice, t],
  );
}
