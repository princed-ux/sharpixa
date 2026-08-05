interface Navigator {
  /** Chromium-only hint. It is deliberately optional and never trusted as exact RAM. */
  readonly deviceMemory?: number;
}
