export default function Navbar() {
    return (
      <nav className="wd-nav">
        <div className="wd-nav__brand">
          <div className="wd-nav__indicator" />
          <span className="wd-nav__title">Watchdog Agent</span>
        </div>
  
        <div className="wd-nav__menu">
          <a href="#demo">Demo</a>
          <a href="#board">Live Board</a>
          <a href="#features">Features</a>
          <a href="#access" className="wd-nav__cta">
            Get API Access
          </a>
        </div>
      </nav>
    );
  }