type SovaLogoProps = {
  wordmarkClassName?: string;
  oClassName?: string;
};

export default function SovaLogo({
  wordmarkClassName = "brand-word",
  oClassName = "brand-word__o",
}: SovaLogoProps) {
  return (
    <span className={wordmarkClassName} role="img" aria-label="SOVA">
      <span aria-hidden="true">S</span>
      <span className={oClassName} aria-hidden="true">O</span>
      <span aria-hidden="true">V</span>
      <span aria-hidden="true">A</span>
    </span>
  );
}
