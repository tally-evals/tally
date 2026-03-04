import { ScrollBarBox } from '@byteland/ink-scroll-bar';
import { useInput, useStdout } from 'ink';
import { ControlledScrollView as ControlledScrollViewBase } from 'ink-scroll-view';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';

// Cast to work around React types version mismatch between ink-scroll-view and React 19
const ControlledScrollView = ControlledScrollViewBase as ComponentType<{
  scrollOffset: number;
  onContentHeightChange: (height: number) => void;
  onViewportSizeChange: () => void;
  children: ReactNode;
}>;

interface ScrollableProps {
  children: ReactNode;
  height?: number | string;
  width?: number | string;
  borderStyle?:
    | 'single'
    | 'double'
    | 'round'
    | 'bold'
    | 'singleDouble'
    | 'doubleSingle'
    | 'classic';
  borderColor?: string;
  focusable?: boolean;
  onScroll?: (offset: number) => void;
  initialScrollOffset?: number;
}

export const Scrollable: React.FC<ScrollableProps> = ({
  children,
  height,
  width,
  borderStyle,
  borderColor,
  focusable = true,
  onScroll,
  initialScrollOffset = 0,
}) => {
  const [scrollOffset, setScrollOffset] = useState(initialScrollOffset);
  const [contentHeight, setContentHeight] = useState(0);
  const { stdout } = useStdout();
  const viewportHeight = Math.max(Number(height ?? 0) - 2, 0);

  const maxScroll = Math.max(0, contentHeight - viewportHeight);

  const handleScrollOffsetChange = (newOffset: number) => {
    setScrollOffset(newOffset);
    if (onScroll) {
      onScroll(newOffset);
    }
  };

  const scrollBy = (delta: number) => {
    const newOffset = Math.max(0, Math.min(maxScroll, scrollOffset + delta));
    handleScrollOffsetChange(newOffset);
  };

  const scrollToBottom = () => {
    handleScrollOffsetChange(maxScroll);
  };

  const scrollToTop = () => {
    handleScrollOffsetChange(0);
  };

  const handleResize = () => {
    if (contentHeight < viewportHeight) {
      setScrollOffset(0);
    }
  };

  useEffect(() => {
    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  useInput((input, key) => {
    if (!focusable) return;

    if (key.upArrow || input === 'k') {
      scrollBy(-5);
    }
    if (key.downArrow || input === 'j') {
      scrollBy(5);
    }
    if (key.pageUp) {
      scrollBy(-viewportHeight);
    }
    if (key.pageDown) {
      scrollBy(viewportHeight);
    }
    if (input === 'g') {
      scrollToTop();
    }
    if (input === 'G') {
      scrollToBottom();
    }
  });

  const boxProps: any = {
    height,
    width,
    // flexDirection: 'column' as const,
  };

  if (borderStyle) boxProps.borderStyle = borderStyle;
  if (borderColor) boxProps.borderColor = borderColor;

  return (
    <ScrollBarBox
      contentHeight={contentHeight}
      viewportHeight={viewportHeight}
      scrollOffset={scrollOffset}
      {...boxProps}
    >
      <ControlledScrollView
        scrollOffset={scrollOffset}
        onContentHeightChange={setContentHeight}
        onViewportSizeChange={handleResize}
      >
        {children}
      </ControlledScrollView>
    </ScrollBarBox>
  );
};
