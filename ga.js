/**
 * Google Analytics (GA4).
 * 1) Создай счётчик на https://analytics.google.com
 * 2) Вставь ID вида G-XXXXXXXX ниже
 * 3) Залей на GitHub
 */
(() => {
  const MEASUREMENT_ID = "G-Q0H40YZ8PV";

  if (!MEASUREMENT_ID || !/^G-[A-Z0-9]+$/i.test(MEASUREMENT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);
})();
