import { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Post } from '@/types';
import { STATUS_LABELS } from '@/types';

const statusColors: Record<string, string> = {
  draft: '#9ca3af',
  pending_approval: '#eab308',
  scheduled: '#3b82f6',
  published: '#22c55e',
  failed: '#ef4444',
  manual_required: '#f97316',
};

export default function CalendarPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<Array<{ id: string; title: string; start: string; backgroundColor: string; extendedProps: Post }>>([]);

  useEffect(() => {
    loadPosts();
  }, [profile]);

  async function loadPosts() {
    let query = supabase.from('posts').select('*, branches(name)').order('scheduled_at');
    if (profile?.role !== 'super_admin' && profile?.branch_id) {
      query = query.eq('branch_id', profile.branch_id);
    }
    const { data } = await query;
    if (data) {
      setEvents(
        (data as Post[])
          .filter((p) => p.scheduled_at)
          .map((p) => ({
            id: p.id,
            title: `${p.title} (${p.platform})`,
            start: p.scheduled_at!,
            backgroundColor: statusColors[p.status] || '#9ca3af',
            extendedProps: p,
          }))
      );
    }
  }

  async function handleEventDrop(info: { event: { id: string; start: Date | null } }) {
    if (!info.event.start) return;
    await supabase
      .from('posts')
      .update({ scheduled_at: info.event.start.toISOString() })
      .eq('id', info.event.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario de publicaciones</h1>
        <button
          onClick={() => navigate('/posts/new')}
          className="bg-pollon-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
        >
          + Nueva publicación
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[key] }} />
            {label}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale="es"
          events={events}
          editable
          eventDrop={handleEventDrop}
          eventClick={(info) => navigate(`/posts/${info.event.id}/edit`)}
          height="auto"
        />
      </div>
    </div>
  );
}
