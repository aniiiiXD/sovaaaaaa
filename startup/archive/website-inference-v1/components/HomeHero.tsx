export default function HomeHero() {
  return (
    <section className="hero" aria-labelledby="home-hero-title">
      <div className="hero-layout shell">
        <div className="hero-copy">
          <p className="hero-kicker">SOVA HOSTED INFERENCE&nbsp; / &nbsp;SPECIALIST MODELS</p>
          <h1 id="home-hero-title">
            Way better
            <br />
            models.
            <br />
            <span>Much better prices.</span>
          </h1>
          <div className="hero-bottomline">
            <p className="hero-intro">
              SOVA hosts specialist models tuned for specific tasks. The same
              work comes back better than the general-purpose default — and
              costs less per task. Benchmark one of your tasks and see quality,
              speed, and cost before you move anything.
            </p>
            <div className="hero-actions">
              <a className="button button--hero" href="#contact">
                Benchmark a workflow
                <span className="button__arrow" aria-hidden="true">↗</span>
              </a>
              <a className="button button--text" href="#sova-stack">
                Meet the SOVA stack
                <span className="button__arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
        <div className="hero-foot" aria-hidden="true">
          <span>One task. A clear benchmark.</span>
          <span>Quality&nbsp; / &nbsp;Speed&nbsp; / &nbsp;Cost</span>
        </div>
      </div>
    </section>
  );
}
