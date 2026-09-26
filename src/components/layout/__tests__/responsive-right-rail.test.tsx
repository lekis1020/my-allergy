import type { ReactElement, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  isWide: false,
  isReady: false,
  effectMounted: false,
  idleCallback: undefined as (() => void) | undefined,
  effectCleanup: undefined as (() => void) | undefined,
  cleanup: vi.fn(),
  useMediaQuery: vi.fn(),
  scheduleAfterIdle: vi.fn(),
  rightRail: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initialValue: T) => [
      harness.effectMounted ? (harness.isReady as T) : initialValue,
      (nextValue: SetStateAction<T>) => {
        harness.isReady = typeof nextValue === "function"
          ? Boolean((nextValue as (previous: T) => T)(harness.isReady as T))
          : Boolean(nextValue);
      },
    ],
    useEffect: (effect: () => void | (() => void)) => {
      if (!harness.effectMounted) {
        harness.effectMounted = true;
        harness.effectCleanup = effect() ?? undefined;
      }
    },
  };
});

vi.mock("next/dynamic", () => ({
  default: () => function MockRightRail(props: { total: number }) {
    harness.rightRail(props);
    return null;
  },
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: harness.useMediaQuery,
}));

vi.mock("@/lib/browser/scheduling", () => ({
  scheduleAfterIdle: harness.scheduleAfterIdle,
}));

import {
  RESPONSIVE_RIGHT_RAIL_QUERY,
  ResponsiveRightRail,
} from "@/components/layout/responsive-right-rail";

function renderResponsiveRightRail(total = 37) {
  const responsiveElement = ResponsiveRightRail({ total });

  if (!responsiveElement) {
    unmountIdleChild();
    return null;
  }

  const idleElement = invokeElement(responsiveElement);
  if (idleElement) invokeElement(idleElement);
  return idleElement;
}

function invokeElement(element: ReactElement): ReactElement | null {
  if (typeof element.type !== "function") {
    throw new Error("Expected a function component");
  }

  const Component = element.type as (props: unknown) => ReactElement | null;
  return Component(element.props);
}

function unmountIdleChild() {
  if (!harness.effectMounted) return;

  harness.effectCleanup?.();
  harness.effectMounted = false;
  harness.effectCleanup = undefined;
}

describe("ResponsiveRightRail", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    harness.isWide = false;
    harness.isReady = false;
    harness.effectMounted = false;
    harness.idleCallback = undefined;
    harness.effectCleanup = undefined;
    harness.cleanup = vi.fn();
    harness.useMediaQuery.mockReset().mockImplementation(() => harness.isWide);
    harness.scheduleAfterIdle.mockReset().mockImplementation((callback: () => void) => {
      harness.idleCallback = callback;
      return harness.cleanup;
    });
    harness.rightRail.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders no child below the Tailwind xl breakpoint", () => {
    expect(RESPONSIVE_RIGHT_RAIL_QUERY).toBe("(min-width: 80rem)");
    expect(renderResponsiveRightRail()).toBeNull();
    expect(harness.useMediaQuery).toHaveBeenCalledWith(RESPONSIVE_RIGHT_RAIL_QUERY);
    expect(harness.scheduleAfterIdle).not.toHaveBeenCalled();
    expect(harness.rightRail).not.toHaveBeenCalled();
  });

  it("renders the real rail only after idle on a wide viewport", () => {
    harness.isWide = true;

    expect(renderResponsiveRightRail()).toBeNull();
    expect(harness.scheduleAfterIdle).toHaveBeenCalledOnce();
    expect(harness.rightRail).not.toHaveBeenCalled();

    harness.idleCallback?.();
    renderResponsiveRightRail();

    expect(harness.rightRail).toHaveBeenCalledWith({ total: 37 });
  });

  it("cancels pending idle work when a resize removes the idle child", () => {
    harness.isWide = true;
    renderResponsiveRightRail();

    harness.isWide = false;
    expect(renderResponsiveRightRail()).toBeNull();

    expect(harness.cleanup).toHaveBeenCalledOnce();
    expect(harness.rightRail).not.toHaveBeenCalled();
  });

  it("cancels pending idle work when the idle child unmounts", () => {
    harness.isWide = true;
    renderResponsiveRightRail();

    unmountIdleChild();

    expect(harness.cleanup).toHaveBeenCalledOnce();
  });
});
