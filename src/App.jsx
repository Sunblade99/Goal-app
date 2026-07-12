import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [why, setWhy] = useState('')
  const [goals, setGoals] = useState([])
  const [checkins, setCheckins] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingId, setEditingId] = useState(null)   // which goal is being edited

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      loadGoals()
      loadCheckins()
    }
  }, [session])

  async function loadGoals() {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.log('Load error:', error.message)
    else setGoals(data)
  }

  async function loadCheckins() {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
    if (error) console.log('Checkin load error:', error.message)
    else setCheckins(data)
  }

  async function handleSignUp() {
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Account created! You are logged in.')
  }

  async function handleLogIn() {
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage('Error: ' + error.message)
  }

  async function handleLogOut() {
    await supabase.auth.signOut()
  }

  // Open the popup in "create" mode
  function openCreateForm() {
    setEditingId(null)
    setTitle('')
    setDeadline('')
    setWhy('')
    setMessage('')
    setShowForm(true)
  }

  // Open the popup in "edit" mode, pre-filled with this goal's values
  function openEditForm(goal) {
    setEditingId(goal.id)
    setTitle(goal.title)
    setDeadline(goal.deadline || '')
    setWhy(goal.why || '')
    setMessage('')
    setShowForm(true)
  }

  // Handles BOTH creating and editing
  async function handleSaveGoal() {
    setMessage('')
    if (!title) {
      setMessage('Please enter a goal name.')
      return
    }
    if (deadline && deadline < todayString()) {
      setMessage('Deadline cannot be in the past.')
      return
    }

    let error
    if (editingId) {
      // UPDATE an existing goal
      const res = await supabase
        .from('goals')
        .update({ title: title, deadline: deadline || null, why: why })
        .eq('id', editingId)
      error = res.error
    } else {
      // INSERT a new goal
      const res = await supabase.from('goals').insert({
        user_id: session.user.id,
        title: title,
        deadline: deadline || null,
        why: why
      })
      error = res.error
    }

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setTitle('')
      setDeadline('')
      setWhy('')
      setEditingId(null)
      setShowForm(false)
      loadGoals()
    }
  }

  async function handleDeleteGoal(goalId) {
    setMessage('')
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (error) setMessage('Error: ' + error.message)
    else {
      setExpandedId(null)
      loadGoals()
    }
  }

  function todayString() {
    return new Date().toISOString().split('T')[0]
  }

  function maxDateString() {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 100)
    return d.toISOString().split('T')[0]
  }

  function checkinCount(goalId) {
    return checkins.filter((c) => c.goal_id === goalId).length
  }

  function checkedInToday(goalId) {
    const today = todayString()
    return checkins.some((c) => c.goal_id === goalId && c.date === today)
  }

  async function handleCheckIn(goalId) {
    setMessage('')
    const { error } = await supabase.from('checkins').insert({
      user_id: session.user.id,
      goal_id: goalId,
      date: todayString()
    })
    if (error) setMessage('Error: ' + error.message)
    else loadCheckins()
  }

  function toggleExpand(goalId) {
    setExpandedId(expandedId === goalId ? null : goalId)
  }

  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h1>Goal App</h1>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <br /><br />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <br /><br />
        <button onClick={handleSignUp}>Sign up</button>{' '}
        <button onClick={handleLogIn}>Log in</button>
        <p>{message}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 500, margin: '0 auto' }}>
      <h1>Goal App</h1>
      <p>Logged in as {session.user.email}{' '}
        <button onClick={handleLogOut}>Log out</button>
      </p>

      <button onClick={openCreateForm} style={{ padding: '10px 16px', fontSize: 16 }}>
        + Add a new goal
      </button>

      <h2>Your goals</h2>
      {goals.length === 0 && <p>No goals yet. Add one above!</p>}
      {goals.map((goal) => (
        <div
          key={goal.id}
          onClick={() => toggleExpand(goal.id)}
          style={{
            border: '1px solid #ccc', borderRadius: 8, padding: 16,
            marginBottom: 12, cursor: 'pointer'
          }}
        >
          <strong style={{
            display: 'block',
            whiteSpace: expandedId === goal.id ? 'normal' : 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {goal.title}
          </strong>

          {expandedId === goal.id && (
            <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
              {goal.why && <div style={{ color: '#666', marginBottom: 6, overflowWrap: 'break-word' }}>Why: {goal.why}</div>}
              {goal.deadline && <div style={{ marginBottom: 6 }}>Deadline: {goal.deadline}</div>}
              <div style={{ marginBottom: 8 }}>Checked in {checkinCount(goal.id)} times</div>
              {checkedInToday(goal.id) ? (
                <button disabled>Done for today ✓</button>
              ) : (
                <button onClick={() => handleCheckIn(goal.id)}>I worked on it today</button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); openEditForm(goal) }}
                style={{ marginLeft: 8, background: '#2980b9', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(goal.id) }}
                style={{ marginLeft: 8, color: 'white', background: '#c0392b', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', padding: 24, borderRadius: 12,
              width: 400, maxWidth: '90%'
            }}
          >
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit goal' : 'Set a new goal'}</h2>
            <input placeholder="What's your goal?" value={title}
              onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
            <br /><br />
            <label>Deadline: </label>
            <input
              type="date"
              value={deadline}
              min={todayString()}
              max={maxDateString()}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <br /><br />
            <textarea placeholder="Why does this matter to you?" value={why}
              onChange={(e) => setWhy(e.target.value)} style={{ width: '100%', height: 60 }} />
            <br /><br />
            <button onClick={handleSaveGoal}>{editingId ? 'Save changes' : 'Add goal'}</button>{' '}
            <button onClick={() => setShowForm(false)}>Cancel</button>
            <p>{message}</p>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div
          onClick={() => setConfirmDeleteId(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', padding: 24, borderRadius: 12, width: 320, maxWidth: '90%' }}
          >
            <p style={{ marginTop: 0 }}>Are you sure you want to delete this goal?</p>
            <button
              onClick={() => { handleDeleteGoal(confirmDeleteId); setConfirmDeleteId(null) }}
              style={{ color: 'white', background: '#c0392b', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
            >
              Yes, delete
            </button>{' '}
            <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App