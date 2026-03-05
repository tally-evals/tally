/**
 * Typed wrapper for ink-scroll-list to fix React 19 type compatibility issues.
 *
 * The ink-scroll-list package exports types compiled against an older React version,
 * causing JSX compatibility errors with React 19. This wrapper uses type assertions
 * to bridge the gap while maintaining the same API.
 */

import {
  ScrollList as InkScrollList,
  type ScrollListProps,
  type ScrollListRef,
} from 'ink-scroll-list';
import type { ForwardRefExoticComponent, RefAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

/**
 * Type-safe ScrollList component compatible with React 19
 *
 * This is a pass-through wrapper that casts the ink-scroll-list component
 * to be compatible with React 19's stricter JSX element types.
 */
export const ScrollList = forwardRef<ScrollListRef, ScrollListProps>(
  (props, ref) => {
    // Cast to work around React 19 type incompatibility
    const TypedScrollList = InkScrollList as unknown as ForwardRefExoticComponent<
      ScrollListProps & RefAttributes<ScrollListRef>
    > & { (props: ScrollListProps & { ref?: React.Ref<ScrollListRef> }): ReactNode };

    return <TypedScrollList ref={ref} {...props} />;
  },
);

ScrollList.displayName = 'ScrollList';

export type { ScrollListProps, ScrollListRef };
