import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * iOS Safari PWA에서 키보드가 올라올 때 발생하는 빈 공간 문제 해결용.
 * window.innerHeight는 고정이지만 visualViewport.height는 키보드 높이만큼 줄어드는 차이를 감지.
 */
export function useVisualViewport() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) {
      return undefined;
    }

    // 데스크탑(fine pointer + hover)에서는 키보드 팝업이 없으므로 항상 0 반환
    if (window.matchMedia('(pointer: fine) and (hover: hover)').matches) {
      return undefined;
    }

    const update = () => {
      const vv = window.visualViewport!;
      // 키보드 높이 = 전체 높이 - 보이는 영역 - 스크롤 오프셋
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(Math.round(kb));
    };

    update();
    window.visualViewport!.addEventListener('resize', update);
    window.visualViewport!.addEventListener('scroll', update);

    return () => {
      window.visualViewport!.removeEventListener('resize', update);
      window.visualViewport!.removeEventListener('scroll', update);
    };
  }, []);

  return keyboardHeight;
}
