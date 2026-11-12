'use strict';

const Icons = (() => {
  const paths = {
    wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h15m3 3h-5a2.5 2.5 0 0 0 0 5h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    swap: '<path d="M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chart: '<path d="M4 20V10m5 10V4m6 16v-7m5 7V7"/>',
    report: '<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8m-8 4h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    out: '<path d="M7 17 17 7m-7 0h7v7"/>',
    in: '<path d="M17 7 7 17m0-7v7h7"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    warning: '<path d="m12 3 10 17H2L12 3Zm0 6v4m0 3h.01"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    food: '<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M18 21V3c-3 3-4 7-3 10h3"/>',
    book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
    home: '<path d="m3 10 9-7 9 7m-2-2v12H5V8m5 12v-6h4v6"/>',
    sprout: '<path d="M12 21v-9M12 15C4 16 2 10 3 5c6 0 10 3 9 10Zm0-3c0-6 3-9 9-9 1 6-3 10-9 9Z"/>',
    repeat: '<path d="M4 9V5h13l3 3M20 15v4H7l-3-3M4 5l4 4m12 10-4-4"/>',
    settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h12"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    print: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7v-7Z"/>'
  };
  return name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.wallet) + '</svg>';
})();
