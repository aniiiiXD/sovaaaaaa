import Link from "next/link";
import { BOOKING_URL, CONTACT_EMAIL, CONTACT_MAILTO, PRODUCT_ORIGIN } from "@/lib/site";
import s from "./Chrome.module.css";

const PRODUCT = [["Explore the APIs", "/#apis"], ["Model catalog", `${PRODUCT_ORIGIN}/models`], ["Demo", "/demo"], ["Documentation", `${PRODUCT_ORIGIN}/docs`], ["Developer portal", `${PRODUCT_ORIGIN}/portal`]] as const;
const STUDIO = [["About Clove", "/about"], ["Careers", "/careers"], ["Get in touch", "/#contact"]] as const;

export default function DojoFooter() {
  const publicEmail = CONTACT_EMAIL !== "hello@sova.example" && CONTACT_EMAIL.trim().length > 0;

  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <div className={s.footerTop}>
          <div className={s.footerIntro}>
            <Link href="/#top" className={s.footerBrand} aria-label="Clove home">
              <svg width="42" height="42" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                <path d="M33.5 8.5A17 17 0 1 0 39 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M13 15.5 22 21l9-5.5-2 12L22 32l-7-4.5-2-12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="m18 22 2 2m6-2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="37.5" cy="11" r="2.3" fill="#8E5B4F" />
              </svg>
              <span>Sovereign intelligence.</span>
            </Link>
            <p>Choose the job.<br />Build with Clove.</p>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={s.footerCall}>Request API access <span aria-hidden="true">↗</span></a>
          </div>
          <nav aria-label="Product links" className={s.footerColumn}>
            <h3>Product</h3>
            {PRODUCT.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <nav aria-label="Studio links" className={s.footerColumn}>
            <h3>Studio</h3>
            {STUDIO.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            {publicEmail && <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>}
          </nav>
        </div>
        <div className={s.footerWordmark} aria-hidden="true">Clove</div>
        <div className={s.footerBottom}>
          <p>© {new Date().getFullYear()} Clove</p>
          <p>Your data stays yours. Training within the agreed scope.</p>
          <a href="#top">Back to the beginning <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    </footer>
  );
}
