(function attachSheetSyncUtils(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.SheetSyncUtils = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSheetSyncUtils() {
  function isScheduleMap(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasScheduleRecords(scheduleData) {
    return isScheduleMap(scheduleData) && Object.keys(scheduleData).length > 0;
  }

  function normalizeMemberId(value) {
    const id = String(value ?? '').trim();
    return /^\d+$/.test(id) ? id.padStart(2, '0') : id;
  }

  function scheduleDataMatches(expected, actual) {
    if (!isScheduleMap(expected) || !isScheduleMap(actual)) {
      return false;
    }

    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();

    if (expectedKeys.length !== actualKeys.length) {
      return false;
    }

    return expectedKeys.every((key, index) => (
      key === actualKeys[index]
      && normalizeMemberId(expected[key]) === normalizeMemberId(actual[key])
    ));
  }

  // An empty response is safe to display, but must never delete an existing
  // local schedule. It can indicate a wrong month, a backend outage, or an
  // incomplete Sheet rather than an intentional request to clear data.
  function shouldReplaceLocalSchedule(localSchedule, remoteSchedule) {
    return hasScheduleRecords(remoteSchedule);
  }

  return {
    hasScheduleRecords,
    normalizeMemberId,
    scheduleDataMatches,
    shouldReplaceLocalSchedule,
  };
}));
