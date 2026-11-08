/**
 * Boots the announcement store only on pages that render announcements.
 * The store is imported on demand so pages without announcements don't ship it.
 */
export async function initAnnouncements(): Promise<void> {
  if (!document.querySelector('[data-announcement-init]')) return;
  const { initAnnouncementState } = await import('@store/announcement');
  initAnnouncementState();
}
