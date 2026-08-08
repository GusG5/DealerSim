import type { EventItem } from '../types'
import { formatTime } from '../lib/format'

interface EventFeedProps {
  events: EventItem[]
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <div className="event-feed">
      <div className="panel-title-row">
        <div>
          <span className="panel-kicker">NEWS &amp; FLOW</span>
          <strong>Market event feed</strong>
        </div>
        <span className="event-count">{events.length}</span>
      </div>
      <div className="event-list">
        {events.length === 0 ? (
          <p className="empty-state">No events yet.</p>
        ) : (
          events.slice(0, 12).map((event) => (
            <article className={`event-row severity-${event.severity}`} key={event.id}>
              <span className="event-time">{formatTime(event.timestamp)}</span>
              <div>
                <strong>{event.headline}</strong>
                {event.detail && <p>{event.detail}</p>}
              </div>
              <span className="event-category">{event.category}</span>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
