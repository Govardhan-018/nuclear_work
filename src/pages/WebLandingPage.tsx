import { Icon } from "../components/Icon"
import { MayaMark } from "../components/MayaMark"

export function WebLandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="web-landing">
      <header className="web-landing-nav">
        <button className="web-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <MayaMark size={34} />
          <span>MAYA</span>
        </button>
        <button className="web-nav-cta" onClick={onEnter}>Open my dashboard</button>
      </header>

      <section className="web-hero">
        <div>
          <p className="web-eyebrow">YOUR PERSONAL SPACE</p>
          <h1>Make space for what matters.</h1>
          <p className="web-hero-copy">
            Maya keeps your focus, habits, reading, food and fitness in one calm,
            private place — made for your life, not for everyone else’s feed.
          </p>
          <div className="web-hero-actions">
            <button className="web-primary" onClick={onEnter}>
              Open my dashboard <Icon name="chevronRight" size={18} />
            </button>
            <a href="#how-it-feels">See what’s inside</a>
          </div>
          <p className="web-private-note">Private by default · Sync across your devices</p>
        </div>

        <div className="web-preview" aria-label="Maya dashboard preview">
          <div className="web-preview-bar">
            <span>Tuesday, November 4</span><i />
          </div>
          <div className="web-preview-title">
            <span>GOOD MORNING</span>
            <strong>Make today count.</strong>
          </div>
          <div className="web-preview-grid">
            <article className="web-preview-focus">
              <Icon name="focus" size={20} />
              <span>FOCUS</span>
              <strong>2h 15m</strong>
              <small>of 4h today</small>
              <div><i style={{ width: "56%" }} /></div>
            </article>
            <article>
              <Icon name="habits" size={20} />
              <span>HABITS</span>
              <strong>4 / 5</strong>
              <small>done today</small>
            </article>
            <article>
              <Icon name="book" size={20} />
              <span>READING</span>
              <strong>28 min</strong>
              <small>quiet time</small>
            </article>
          </div>
          <div className="web-preview-list">
            <span>UP NEXT</span>
            <div><i /><strong>Review project notes</strong><small>10:30</small></div>
            <div><i /><strong>Evening walk</strong><small>18:00</small></div>
          </div>
        </div>
      </section>

      <section className="web-pillars" id="how-it-feels">
        <div>
          <span className="web-number">01</span>
          <Icon name="focus" size={24} />
          <h2>Find your focus</h2>
          <p>Turn good intentions into dedicated time, without clutter or pressure.</p>
        </div>
        <div>
          <span className="web-number">02</span>
          <Icon name="habits" size={24} />
          <h2>See your rhythm</h2>
          <p>Notice patterns across the small things that shape your days.</p>
        </div>
        <div>
          <span className="web-number">03</span>
          <Icon name="insights" size={24} />
          <h2>Keep perspective</h2>
          <p>One home for your tasks, health, reading and weekly reflections.</p>
        </div>
      </section>

      <section className="web-closing">
        <p className="web-eyebrow">A QUIETER WAY TO PLAN</p>
        <h2>Your dashboard is ready when you are.</h2>
        <button className="web-primary" onClick={onEnter}>
          Enter Maya <Icon name="chevronRight" size={18} />
        </button>
      </section>

      <footer className="web-landing-footer">
        <span><MayaMark size={22} /> MAYA</span>
        <small>Built for your day, on your terms.</small>
      </footer>
    </main>
  )
}
