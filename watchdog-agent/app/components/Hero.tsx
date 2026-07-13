export default function Hero() {
    return (
      <section className="hero">
        <div className="hero__content">
          <span className="hero__badge">
            ● Monitoring Active
          </span>
  
          <h1>
            Detect changes
            <br />
            before your users do.
          </h1>
  
          <p>
            Watchdog continuously monitors websites, APIs, response
            times and schemas. When something changes, you'll know
            instantly.
          </p>
  
          <div className="hero__buttons">
            <a href="#demo" className="hero__primary">
              Start Watching
            </a>
  
            <a href="#board" className="hero__secondary">
              Live Demo
            </a>
          </div>
        </div>
  
        <div className="hero__card">
  
          <div className="status-row">
  
            <span>api.stripe.com</span>
  
            <span className="healthy">
              Healthy
            </span>
  
          </div>
  
          <div className="status-row">
  
            <span>inventory-api</span>
  
            <span className="warning">
              Schema Changed
            </span>
  
          </div>
  
          <div className="status-row">
  
            <span>payments</span>
  
            <span className="healthy">
              Healthy
            </span>
  
          </div>
  
        </div>
      </section>
    );
  }