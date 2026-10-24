import { useEffect, useMemo, useState } from 'react';
import { useStore } from './state.js';
import { addDays, dateRange, fmtTripDates, fromMin, toMin, todayISO, tripCountdown } from './lib/time.js';
import { Logo, SearchBox, TripMenu, ViewToggle } from './components/Header.jsx';
import CalendarGrid from './components/CalendarGrid.jsx';
import DayStrip from './components/DayStrip.jsx';
import DayAgenda from './components/DayAgenda.jsx';
import ExplorePanel from './components/ExplorePanel.jsx';
import SplitLayout from './components/SplitLayout.jsx';
import MapView from './components/MapView.jsx';
import ActivitySheet from './components/ActivitySheet.jsx';
import StaySheet from './components/StaySheet.jsx';
import PlaceSheet from './components/PlaceSheet.jsx';
import WhereBanner from './components/WhereBanner.jsx';
import { cityFilterOptions, dayPlaces, placeSummary } from './lib/dayplaces.js';
import CityFilter from './components/CityFilter.jsx';
import TripSheet from './components/TripSheet.jsx';
import TodoPanel from './components/TodoPanel.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import TripsPage from './components/TripsPage.jsx';
import BottomNav from './components/BottomNav.jsx';
import Sheet from './components/Sheet.jsx';
import Icon from './components/Icon.jsx';
import { SyncStatus, confirmSignOut } from './components/Cloud.jsx';
import AuthPage, { SetPasswordPage, Splash } from './components/AuthPage.jsx';
import { useCloudSync } from './sync.js';
import { useTheme } from './theme.js';
import useDaySwipe from './lib/useDaySwipe.js';
import { defaultType, setUserCategories } from './categories.js';
import { canEdit, isShared, ownerLabel } from './lib/owner.js';
import ShareSheet from './components/ShareSheet.jsx';

function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function matches(a, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [a.title, a.location, a.notes].some((v) => v && v.toLowerCase().includes(s));
}

export default function App() {
  const [state, dispatch] = useStore();
  // Your own activity types (names, symbols, colors) for everything drawn below.
  setUserCategories(state.categories, state.sharedTypes);
  const isMobile = useMediaQuery('(max-width: 760px)');
  const cloud = useCloudSync(state, dispatch);
  const theme = useTheme();

  const [view, setView] = useState('week'); // desktop: day | week | map | trips
  const [tab, setTab] = useState('itinerary'); // phone: itinerary | map | todo | trips
  const [picked, setPicked] = useState(null); // selected date ('' = ideas)
  const [filter, setFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState(null); // 'country|city' key
  const [query, setQuery] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mobileMode, setMobileMode] = useState('calendar'); // calendar | list
  const [activitySheet, setActivitySheet] = useState(null);
  const [draft, setDraft] = useState(null); // new activity being filled in (shown on the calendar)
  const [staySheet, setStaySheet] = useState(null);
  const [stayDraft, setStayDraft] = useState(null);
  const [placeSheet, setPlaceSheet] = useState(null);
  const [sheetSide, setSheetSide] = useState(null); // 'left' | 'right' when opened from the calendar
  const [tripSheet, setTripSheet] = useState(null);
  const [todoOpen, setTodoOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const trip = state.trips.find((t) => t.id === state.currentTripId) || state.trips[0] || null;
  // Trips shared with you as "view only" can be looked at but not changed.
  const readOnly = !!trip && !canEdit(trip);
  const [shareSheet, setShareSheet] = useState(null); // trip being shared
  const dates = useMemo(() => (trip ? dateRange(trip.start, trip.end) : []), [trip]);

  const counts = useMemo(() => {
    const c = {};
    state.activities.forEach((a) => (c[a.tripId] = (c[a.tripId] || 0) + 1));
    return c;
  }, [state.activities]);
  const todoCounts = useMemo(() => {
    const c = {};
    state.todos.forEach((t) => !t.done && (c[t.tripId] = (c[t.tripId] || 0) + 1));
    return c;
  }, [state.todos]);

  const all = useMemo(() => (trip ? state.activities.filter((a) => a.tripId === trip.id) : []), [state.activities, trip]);

  const { byDate, ideas, dayCounts } = useMemo(() => {
    const set = new Set(dates);
    const byDate = {};
    const ideas = [];
    const dayCounts = {};
    all.forEach((a) => {
      const scheduled = a.date && set.has(a.date);
      if (scheduled) dayCounts[a.date] = (dayCounts[a.date] || 0) + 1;
      if ((filter !== 'all' && a.category !== filter) || !matches(a, query)) return;
      if (scheduled) (byDate[a.date] ||= []).push(a);
      else ideas.push(a);
    });
    return { byDate, ideas, dayCounts };
  }, [all, dates, filter, query]);
  const allIdeasCount = all.filter((a) => !a.date || !dates.includes(a.date)).length;

  const tripPlaces = useMemo(() => (trip ? (state.places || []).filter((p) => p.tripId === trip.id) : []), [state.places, trip]);
  const dayInfo = useMemo(() => dayPlaces(dates, tripPlaces, trip), [dates, tripPlaces, trip]);

  // "Country, City" filter: only show the days spent in one city (travel days count for both cities).
  const cityOptions = useMemo(() => cityFilterOptions(dates, dayInfo), [dates, dayInfo]);
  const activeCity = cityOptions.find((c) => c.key === cityFilter) || null;
  const viewDates = activeCity ? activeCity.dates : dates;

  // The selected day falls back to today (if the trip is on) or the first day.
  const today = todayISO();
  const selected =
    picked !== null && (picked === '' ? allIdeasCount > 0 || dates.length === 0 : viewDates.includes(picked))
      ? picked
      : viewDates.includes(today)
        ? today
        : viewDates[0] ?? '';
  const dayItems = selected ? byDate[selected] || [] : ideas;

  const tripTodos = trip ? state.todos.filter((t) => t.tripId === trip.id) : [];
  const tripCountries = [...new Set(tripPlaces.slice().sort((a, b) => a.start.localeCompare(b.start)).map((p) => p.country).filter(Boolean))];
  const tripStays = useMemo(() => (trip ? (state.stays || []).filter((s) => s.tripId === trip.id) : []), [state.stays, trip]);
  const openTodos = tripTodos.filter((t) => !t.done).length;

  // ----- actions
  const openAdd = (date, start) => {
    if (readOnly) return;
    const d = date === undefined ? selected : date;
    setSheetSide(null);
    setDraft(null);
    setActivitySheet({
      date: d,
      start: start || '',
      end: start ? fromMin(toMin(start) + 60) : '',
      category: defaultType(),
    });
  };
  const openEdit = (a) => {
    setSheetSide(null);
    setActivitySheet(a);
  };
  // From the calendar grid: click/drag on an empty slot, or drag an activity.
  const createAt = ({ date, start, end, x }) => {
    if (readOnly) return;
    setDraft({ date, start, end, title: '' });
    setSheetSide(x != null && x > window.innerWidth / 2 ? 'left' : 'right');
    setActivitySheet({ date, start, end, category: defaultType() });
  };
  const closeActivitySheet = () => {
    setActivitySheet(null);
    setDraft(null);
    setSheetSide(null);
  };
  const pending = activitySheet && !activitySheet.id ? draft : null;

  // Stays (hotels) — the Stay row in the calendar.
  const createStay = ({ checkIn, checkOut, x }) => {
    if (readOnly) return;
    setSheetSide(x != null && x > window.innerWidth / 2 ? 'left' : 'right');
    setStayDraft({ checkIn, checkOut, name: '' });
    setStaySheet({ checkIn, checkOut });
  };
  const editStay = (s) => {
    setSheetSide(null);
    setStaySheet(s);
  };
  const closeStaySheet = () => {
    setStaySheet(null);
    setStayDraft(null);
    setSheetSide(null);
  };
  const pendingStay = staySheet && !staySheet.id ? stayDraft : null;
  // Which city a day is in: open the city that covers it, or start a new one for that day.
  const editPlace = (date) => {
    const info = dayInfo[date];
    if (info && !info.implied) return setPlaceSheet(info.to);
    if (readOnly) return;
    // No cities yet: offer the trip's destination for the whole trip.
    if (info?.implied) return setPlaceSheet({ city: info.to.city, country: info.to.country, start: trip.start, end: trip.end });
    setPlaceSheet({ start: date, end: date });
  };
  const stayProps = {
    readOnly,
    dayInfo,
    onEditPlace: editPlace,
    stays: tripStays,
    pendingStay,
    onCreateStay: createStay,
    onEditStay: editStay,
    onUpdateStay: (stay) => dispatch({ type: 'saveStay', stay }),
  };
  const updateActivity = (activity) => dispatch({ type: 'saveActivity', activity });
  // Day & List views: search for places near the day's city and add them to the day.
  const dayCity = selected && dayInfo[selected]?.to ? [dayInfo[selected].to.city, dayInfo[selected].to.country].filter(Boolean).join(', ') : '';
  const explorePanel = trip && (
    <ExplorePanel
      trip={trip}
      date={selected}
      city={dayCity}
      items={selected ? all.filter((a) => a.date === selected) : []}
      allItems={all}
      readOnly={readOnly}
      onAdd={updateActivity}
      onEdit={openEdit}
    />
  );
  // Phone: swipe left/right on the day to go to the next/previous day (same order as the day chips).
  const [swipeEl, setSwipeEl] = useState(null);
  const swipeDays = [...(allIdeasCount > 0 && !activeCity ? [''] : []), ...viewDates];
  const swipeAt = swipeDays.indexOf(selected);
  useDaySwipe(swipeEl, {
    enabled: isMobile && tab === 'itinerary' && swipeAt >= 0 && !activitySheet && !staySheet,
    canPrev: swipeAt > 0,
    canNext: swipeAt >= 0 && swipeAt < swipeDays.length - 1,
    onPrev: () => setPicked(swipeDays[swipeAt - 1]),
    onNext: () => setPicked(swipeDays[swipeAt + 1]),
  });
  const selectTrip = (id) => {
    dispatch({ type: 'selectTrip', id });
    setPicked(null);
    setFilter('all');
    setCityFilter(null);
    setQuery('');
    if (isMobile) setTab('itinerary');
    else setView((v) => (v === 'trips' ? 'week' : v));
  };
  const addDay = () => {
    if (!trip.start) return setTripSheet(trip);
    dispatch({ type: 'saveTrip', trip: { ...trip, end: addDays(trip.end || trip.start, 1) } });
  };
  const openDay = (d) => {
    setPicked(d);
    setView('day');
  };

  const sheets = (
    <>
      {activitySheet && trip && (
        <ActivitySheet
          readOnly={readOnly}
          trip={trip}
          dates={dates}
          initial={activitySheet}
          placement={sheetSide || undefined}
          onDraftChange={setDraft}
          onClose={closeActivitySheet}
          onSave={(activity) => {
            dispatch({ type: 'saveActivity', activity });
            closeActivitySheet();
            if (isMobile || view === 'day' || view === 'list') setPicked(activity.date && dates.includes(activity.date) ? activity.date : '');
          }}
          onDelete={(id) => {
            dispatch({ type: 'deleteActivity', id });
            closeActivitySheet();
          }}
        />
      )}
      {placeSheet && trip && (
        <PlaceSheet
          readOnly={readOnly}
          trip={trip}
          initial={placeSheet}
          others={tripPlaces}
          onClose={() => setPlaceSheet(null)}
          onSave={(place) => {
            dispatch({ type: 'savePlace', place });
            setPlaceSheet(null);
          }}
          onDelete={(id) => {
            dispatch({ type: 'deletePlace', id });
            setPlaceSheet(null);
          }}
        />
      )}
      {staySheet && trip && (
        <StaySheet
          readOnly={readOnly}
          trip={trip}
          initial={staySheet}
          placement={sheetSide || undefined}
          onDraftChange={setStayDraft}
          onClose={closeStaySheet}
          onSave={(stay) => {
            dispatch({ type: 'saveStay', stay });
            closeStaySheet();
          }}
          onDelete={(id) => {
            dispatch({ type: 'deleteStay', id });
            closeStaySheet();
          }}
        />
      )}
      {tripSheet && (
        <TripSheet
          initial={tripSheet}
          activityCount={tripSheet.id ? counts[tripSheet.id] || 0 : 0}
          plans={state}
          readOnly={!!tripSheet.id && !canEdit(tripSheet)}
          sharing={cloud.user ? { count: cloud.membersOf(tripSheet).length, onOpen: () => { setShareSheet(tripSheet); setTripSheet(null); } } : null}
          onClose={() => setTripSheet(null)}
          onSave={(t, plans) => {
            const isNew = !state.trips.some((x) => x.id === t.id);
            dispatch({ type: 'saveTrip', trip: t, plans });
            setTripSheet(null);
            if (isNew) selectTrip(t.id);
          }}
          onDelete={(id) => {
            dispatch({ type: 'deleteTrip', id });
            setTripSheet(null);
            setPicked(null);
          }}
        />
      )}
      {shareSheet && cloud.user && (
        <ShareSheet
          trip={state.trips.find((t) => t.id === shareSheet.id) || shareSheet}
          cloud={cloud}
          onClose={() => setShareSheet(null)}
          onLeft={() => {
            setShareSheet(null);
            setPicked(null);
          }}
        />
      )}
    </>
  );

  const tripsPage = (
    <TripsPage
      state={state}
      counts={counts}
      todoCounts={todoCounts}
      onOpen={selectTrip}
      onNewTrip={() => setTripSheet({})}
      dispatch={dispatch}
      cloud={cloud}
      theme={theme}
    />
  );

  const noDates = trip && dates.length === 0;
  const noDatesCard = (
    <div className="empty">
      <p>Add dates to {trip?.name} to plan it day by day. Until then, places are saved as ideas.</p>
      <button type="button" className="btn btn-primary" onClick={() => setTripSheet(trip)}>Set trip dates</button>
    </div>
  );

  // ================= Sign-in gate (only when Supabase is configured)
  if (cloud.enabled) {
    if (!cloud.ready) return <Splash />;
    if (!cloud.user) return <AuthPage cloud={cloud} />;
    if (cloud.recovery) return <SetPasswordPage cloud={cloud} />;
    if (cloud.status === 'loading' && state.trips.length === 0) return <Splash text="Loading your trips…" />;
  }

  // ================= Phone layout
  if (isMobile) {
    const showTrips = tab === 'trips' || !trip;
    return (
      <div className={`app is-mobile${(pending?.start || pendingStay) && sheetSide ? ' has-peek' : ''}`}>
        {showTrips ? (
          <main className="m-main">{tripsPage}</main>
        ) : (
          <>
            <header className="m-top">
              <div className="m-top-row">
                <button type="button" className="m-trip" onClick={() => setTab('trips')}>
                  <span className="m-trip-name">{trip.name}</span>
                  <span className="m-trip-sub">
                    {readOnly && <span className="m-ro"><Icon name="eye" size={12} /> View only · </span>}
                    {fmtTripDates(trip)}
                    {tripCountries.length ? ` · ${tripCountries.join(', ')}` : trip.start && ` · ${tripCountdown(trip).toLowerCase()}`}
                  </span>
                </button>
                <button type="button" className="icon-btn boxed" aria-label="Trip details" onClick={() => setTripSheet(trip)}>
                  <Icon name="edit" size={18} />
                </button>
                {tab === 'itinerary' && selected && (
                  <button
                    type="button"
                    className="icon-btn boxed"
                    aria-label={mobileMode === 'calendar' ? 'Show as list' : 'Show as calendar'}
                    title={mobileMode === 'calendar' ? 'List' : 'Calendar'}
                    onClick={() => setMobileMode((m) => (m === 'calendar' ? 'list' : 'calendar'))}
                  >
                    <Icon name={mobileMode === 'calendar' ? 'list' : 'calendar'} size={18} />
                  </button>
                )}
                {tab === 'itinerary' && (
                  <button type="button" className="icon-btn boxed" aria-label="Search" aria-expanded={mobileSearch} onClick={() => { setMobileSearch((s) => !s); setQuery(''); }}>
                    <Icon name={mobileSearch ? 'close' : 'search'} size={18} />
                  </button>
                )}
              </div>
              {tab === 'itinerary' && mobileSearch && <SearchBox value={query} onChange={setQuery} />}
            </header>
            <main className={`m-main${tab === 'itinerary' && selected && mobileMode === 'calendar' ? ' is-cal' : ''}${tab === 'todo' || tab === 'notes' ? ' is-todo' : ''}`} ref={setSwipeEl} data-day={tab === 'itinerary' ? selected : undefined}>
              {tab === 'itinerary' && (
                <>
                  <CityFilter options={cityOptions} value={cityFilter} onChange={setCityFilter} />
                  {noDates && noDatesCard}
                  {selected ? (
                    mobileMode === 'calendar' ? (
                      // Google Calendar style: the date, city and hotel live in the calendar's own header.
                      <CalendarGrid
                        variant="gcal"
                        onPickDate={(d) => setPicked(d)}
                        pickRange={viewDates}
                        where={placeSummary(selected, dayInfo, dates)}
                        dates={[selected]}
                        byDate={byDate}
                        onCreate={createAt}
                        pending={pending}
                        {...stayProps}
                        onEdit={openEdit}
                        onUpdate={updateActivity}
                        hourHeight={60}
                        colMin={0}
                      />
                    ) : (
                      <>
                        <WhereBanner date={selected} dates={dates} dayInfo={dayInfo} onEdit={editPlace} />
                        <DayAgenda date={selected} items={dayItems} onEdit={openEdit} onAdd={readOnly ? undefined : openAdd} stays={tripStays} onEditStay={editStay} />
                      </>
                    )
                  ) : (
                    <DayAgenda date={selected} items={dayItems} onEdit={openEdit} onAdd={readOnly ? undefined : openAdd} stays={tripStays} onEditStay={editStay} />
                  )}
                </>
              )}
              {tab === 'map' && <MapView trip={trip} dates={viewDates} byDate={byDate} ideas={activeCity ? [] : ideas} />}
              {tab === 'todo' && (
                <>
                  <h1 className="m-title">To-do</h1>
                  <TodoPanel trip={trip} todos={tripTodos} dispatch={dispatch} readOnly={readOnly} />
                </>
              )}
              {tab === 'notes' && (
                <>
                  <h1 className="m-title">Notes</h1>
                  <NotesPanel key={trip.id} trip={trip} dispatch={dispatch} readOnly={readOnly} />
                </>
              )}
            </main>
            {(tab === 'itinerary' || tab === 'map') && !readOnly && (
              <button type="button" className="fab" aria-label="Add activity" onClick={() => openAdd()}>
                <Icon name="plus" size={26} stroke={2.4} />
              </button>
            )}
          </>
        )}
        <BottomNav tab={showTrips ? 'trips' : tab} onChange={setTab} todoCount={openTodos} />
        {sheets}
      </div>
    );
  }

  // ================= Desktop layout
  const showTrips = view === 'trips' || !trip;
  return (
    <div className="app is-desktop">
      <header className="topbar">
        <div className="container topbar-inner">
          <Logo />
          {trip && (
            <TripMenu
              trips={state.trips}
              trip={trip}
              counts={counts}
              onSelect={selectTrip}
              onNewTrip={() => setTripSheet({})}
              onEditTrip={() => setTripSheet(trip)}
              onAllTrips={() => setView('trips')}
              userEmail={cloud.displayName ? `${cloud.displayName} (${cloud.user?.email})` : cloud.user?.email}
              onSignOut={() => confirmSignOut(cloud)}
            />
          )}
          {trip && <ViewToggle view={showTrips ? null : view} onChange={setView} />}
          <div className="grow" />
          {!showTrips && <SearchBox value={query} onChange={setQuery} />}
          <button
              type="button"
              className="icon-btn theme-btn"
              onClick={theme.toggle}
              aria-label={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme.resolved === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          {trip && !showTrips && cloud.user && (
            <button type="button" className="btn share-btn" onClick={() => setShareSheet(trip)}>
              <Icon name={isShared(trip.id) ? 'people' : 'share'} size={16} /> {isShared(trip.id) ? 'Shared' : 'Share'}
              {!isShared(trip.id) && cloud.membersOf(trip).length > 0 && <span className="count-badge">{cloud.membersOf(trip).length}</span>}
            </button>
          )}
          {trip && !showTrips && (
            <button type="button" className="btn" onClick={() => setTodoOpen(true)}>
              <Icon name="checklist" size={16} /> To-do
              {openTodos > 0 && <span className="count-badge">{openTodos}</span>}
            </button>
          )}
          {trip && !showTrips && (
            <button type="button" className="btn" onClick={() => setNotesOpen(true)}>
              <Icon name="note" size={16} /> Notes
              {trip.notes?.trim() && <span className="notes-dot" aria-label="has notes" />}
            </button>
          )}
          {trip && !showTrips && !readOnly && (
            <button type="button" className="btn btn-primary" onClick={() => openAdd(view === 'day' ? selected : dates[0] ?? '')}>
              <Icon name="plus" size={16} /> Add activity
            </button>
          )}
        </div>
      </header>

      <main className="container main">
        {showTrips ? (
          tripsPage
        ) : (
          <>
            <div className="toolbar">
              <CityFilter options={cityOptions} value={cityFilter} onChange={setCityFilter} />
              <div className="grow" />
              {isShared(trip.id) && (
                <button type="button" className={`ro-chip${readOnly ? ' is-view' : ''}`} onClick={() => setShareSheet(trip)}>
                  <Icon name={readOnly ? 'eye' : 'people'} size={14} />
                  {readOnly ? 'View only' : 'Can edit'} · shared by {ownerLabel(trip)}
                </button>
              )}
              <SyncStatus cloud={cloud} />
            </div>

            {view === 'week' &&
              (dates.length === 0 ? (
                <>
                  {noDatesCard}
                  <DayAgenda date="" items={ideas} onEdit={openEdit} onAdd={readOnly ? undefined : openAdd} />
                </>
              ) : (
                <>
                  <div className="cal-bar">
                    <span className="cal-toolbar-note">Click a time to add · drag to choose a range · drag an activity to move it</span>
                    <div className="grow" />
                    {allIdeasCount > 0 && (
                      <button type="button" className="btn btn-sm" onClick={() => { setPicked(''); setView('list'); }}>
                        ✦ {allIdeasCount} unscheduled {allIdeasCount === 1 ? 'idea' : 'ideas'}
                      </button>
                    )}
                    {!readOnly && <button type="button" className="btn btn-sm" onClick={addDay}>
                      <Icon name="plus" size={14} /> Add day
                    </button>}
                  </div>
                  <CalendarGrid dates={viewDates} byDate={byDate} onCreate={createAt} pending={pending} {...stayProps} onEdit={openEdit} onUpdate={updateActivity} onOpenDay={openDay} colMin={150} />
                </>
              ))}

            {view === 'day' && (
              <>
                {dates.length > 0 ? (
                  <DayStrip dates={viewDates} selected={selected} onSelect={setPicked} counts={dayCounts} showIdeas={allIdeasCount > 0 && !activeCity} ideasCount={allIdeasCount} dayInfo={dayInfo} />
                ) : (
                  noDatesCard
                )}
                {selected && <WhereBanner date={selected} dates={dates} dayInfo={dayInfo} onEdit={editPlace} />}
                {selected ? (
                  <SplitLayout
                    className="day-cal-layout"
                    main={<CalendarGrid dates={[selected]} byDate={byDate} onCreate={createAt} pending={pending} {...stayProps} onEdit={openEdit} onUpdate={updateActivity} hourHeight={56} colMin={240} />}
                    side={explorePanel}
                  />
                ) : (
                  <SplitLayout
                    className="day-layout"
                    main={<DayAgenda date={selected} items={dayItems} onEdit={openEdit} onAdd={readOnly ? undefined : openAdd} stays={tripStays} onEditStay={editStay} />}
                    side={explorePanel}
                  />
                )}
              </>
            )}

            {view === 'list' && (
              <>
                {dates.length > 0 ? (
                  <DayStrip dates={viewDates} selected={selected} onSelect={setPicked} counts={dayCounts} showIdeas={allIdeasCount > 0 && !activeCity} ideasCount={allIdeasCount} dayInfo={dayInfo} />
                ) : (
                  noDatesCard
                )}
                {selected && <WhereBanner date={selected} dates={dates} dayInfo={dayInfo} onEdit={editPlace} />}
                <SplitLayout
                  className="day-layout"
                  main={<DayAgenda date={selected} items={dayItems} onEdit={openEdit} onAdd={readOnly ? undefined : openAdd} stays={tripStays} onEditStay={editStay} />}
                  side={explorePanel}
                />
              </>
            )}

            {view === 'map' && <MapView trip={trip} dates={viewDates} byDate={byDate} ideas={activeCity ? [] : ideas} />}
          </>
        )}
      </main>

      {todoOpen && trip && (
        <Sheet title={`To-do · ${trip.name}`} onClose={() => setTodoOpen(false)}>
          <TodoPanel trip={trip} todos={tripTodos} dispatch={dispatch} readOnly={readOnly} />
        </Sheet>
      )}
      {notesOpen && trip && (
        <Sheet title={`Notes · ${trip.name}`} onClose={() => setNotesOpen(false)}>
          <NotesPanel key={trip.id} trip={trip} dispatch={dispatch} readOnly={readOnly} />
        </Sheet>
      )}
      {sheets}
    </div>
  );
}
