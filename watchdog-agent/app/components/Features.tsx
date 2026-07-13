export default function Features() {
    const features = [
      {
        title: "Website Monitoring",
        description:
          "Track websites and know immediately when content changes.",
        icon: "🌐",
      },
      {
        title: "API Monitoring",
        description:
          "Detect status code changes before they affect your users.",
        icon: "⚡",
      },
      {
        title: "Schema Detection",
        description:
          "Catch unexpected API contract changes automatically.",
        icon: "🧩",
      },
      {
        title: "Latency Tracking",
        description:
          "Know when response times start increasing.",
        icon: "📈",
      },
    ];
  
    return (
      <section id="features" className="features">
        <div className="section-heading">
          <span>Features</span>
          <h2>Everything you need to monitor production.</h2>
        </div>
  
        <div className="feature-grid">
          {features.map((feature) => (
            <div className="feature-card" key={feature.title}>
              <div className="feature-icon">{feature.icon}</div>
  
              <h3>{feature.title}</h3>
  
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }