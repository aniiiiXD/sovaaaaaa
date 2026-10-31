import styles from "./SovaStack.module.css";

const stackLayers = [
  {
    number: "01",
    title: "Direct inference",
    description:
      "Run multiple general and specialist models on SOVA-hosted inference through one endpoint. Keep your agent integration stable as the model mix improves.",
  },
  {
    number: "02",
    title: "Evaluation library",
    description:
      "Replay your real cases against the same checks for answer quality, latency, and cost. Keep frontier models where they win.",
  },
  {
    number: "03",
    title: "Post-training rig",
    description:
      "Adapt promising models with approved examples and expert corrections. Promote them only when held-out evaluations show a useful gain.",
  },
];

export default function SovaStack() {
  return (
    <section className={styles.section} id="sova-stack" aria-labelledby="sova-stack-title">
      <div className={`shell ${styles.container}`}>
        <div className={`section-tag ${styles.sectionLabel}`}>
          <span>MEET THE SOVA STACK</span>
        </div>

        <header className={styles.intro}>
          <h2 id="sova-stack-title">One hosted stack. Models made for the work.</h2>
          <p>
            Connect once, test against the work your agents actually do, and
            specialize a model when the results justify it.
          </p>
        </header>

        <div className={styles.layers}>
          {stackLayers.map((layer) => (
            <article className={styles.layer} key={layer.number}>
              <span className={styles.number}>{layer.number}</span>
              <h3>{layer.title}</h3>
              <p>{layer.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
