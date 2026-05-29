import { useState, useEffect } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aewfojdqwbvsgfkmzhxy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFld2ZvamRxd2J2c2dma216aHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDcxNjcsImV4cCI6MjA5NTU4MzE2N30.OmPBxV0Wm91qcSVTZJB8KJC02MgdRyWwrez-rD-xit8";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = "01001010 01001101";

const GRADES = ["1ro", "2do", "3ro", "4to", "5to"];

const BADGES = [
  { id: "participant", name: "Participante", icon: "🎮", color: "#4ade80", desc: "Inscrito en el torneo" },
  { id: "quarterfinal", name: "Cuartos de Final", icon: "⚔️", color: "#facc15", desc: "Llegó a cuartos de final" },
  { id: "semifinal", name: "Semifinalista", icon: "🔥", color: "#fb923c", desc: "Llegó a semifinales" },
  { id: "finalist", name: "Finalista", icon: "💎", color: "#c084fc", desc: "Llegó a la final" },
  { id: "champion", name: "Campeón", icon: "👑", color: "#fbbf24", desc: "¡Ganó el torneo!" },
];

// =========== SUPABASE HOOKS ===========

function useSupabaseData() {
  const [teams, setTeams] = useState([]);
  const [soloPlayers, setSoloPlayers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [brackets, setBrackets] = useState({ rounds: [] });
  const [settings, setSettings] = useState({ tournamentName: "BRAWL STARS CHAMPIONSHIP", tournamentSubtitle: "Liga Escolar Secundaria 2025" });
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [t, s, a, b, st] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("solo_players").select("*"),
      supabase.from("announcements").select("*"),
      supabase.from("brackets").select("*").eq("id", 1).single(),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);
    if (t.data) setTeams(t.data.map(normalizeTeam));
    if (s.data) setSoloPlayers(s.data.map(normalizeSolo));
    if (a.data) setAnnouncements(a.data);
    if (b.data) setBrackets(b.data.rounds ? { rounds: b.data.rounds } : { rounds: [] });
    if (st.data) setSettings({ tournamentName: st.data.tournament_name, tournamentSubtitle: st.data.tournament_subtitle });
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();

    const teamSub = supabase.channel("teams-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchAll())
      .subscribe();
    const soloSub = supabase.channel("solo-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "solo_players" }, () => fetchAll())
      .subscribe();
    const annSub = supabase.channel("ann-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => fetchAll())
      .subscribe();
    const bracketSub = supabase.channel("bracket-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "brackets" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(teamSub);
      supabase.removeChannel(soloSub);
      supabase.removeChannel(annSub);
      supabase.removeChannel(bracketSub);
    };
  }, []);

  return { teams, soloPlayers, announcements, brackets, settings, loading, refetch: fetchAll };
}

function normalizeTeam(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    captain: row.captain,
    captainGrade: row.captain_grade,
    contact: row.contact,
    members: row.members || [],
    status: row.status,
    badges: row.badges || ["participant"],
    wins: row.wins || 0,
    losses: row.losses || 0,
    matchHistory: row.match_history || [],
    createdAt: row.created_at,
  };
}

function normalizeSolo(row) {
  return { id: row.id, name: row.name, grade: row.grade, contact: row.contact, isSubstitute: row.is_substitute };
}

// DB helpers
const db = {
  addTeam: (team) => supabase.from("teams").insert({
    id: team.id, name: team.name, icon: team.icon, captain: team.captain,
    captain_grade: team.captainGrade, contact: team.contact, members: team.members,
    status: team.status, badges: team.badges, wins: team.wins, losses: team.losses,
    match_history: team.matchHistory, created_at: team.createdAt,
  }),
  updateTeam: (id, patch) => {
    const dbPatch = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.badges !== undefined) dbPatch.badges = patch.badges;
    if (patch.wins !== undefined) dbPatch.wins = patch.wins;
    if (patch.losses !== undefined) dbPatch.losses = patch.losses;
    if (patch.matchHistory !== undefined) dbPatch.match_history = patch.matchHistory;
    return supabase.from("teams").update(dbPatch).eq("id", id);
  },
  deleteTeam: (id) => supabase.from("teams").delete().eq("id", id),
  addSolo: (p) => supabase.from("solo_players").insert({ id: p.id, name: p.name, grade: p.grade, contact: p.contact, is_substitute: false }),
  updateSolo: (id, patch) => supabase.from("solo_players").update({ is_substitute: patch.isSubstitute }).eq("id", id),
  deleteSolo: (id) => supabase.from("solo_players").delete().eq("id", id),
  addAnnouncement: (a) => supabase.from("announcements").insert(a),
  deleteAnnouncement: (id) => supabase.from("announcements").delete().eq("id", id),
  saveBrackets: (rounds) => supabase.from("brackets").upsert({ id: 1, rounds }),
  saveSettings: (s) => supabase.from("settings").upsert({ id: 1, tournament_name: s.tournamentName, tournament_subtitle: s.tournamentSubtitle }),
};

// =========== UI COMPONENTS ===========

function Badge({ badge, size = "md" }) {
  const sz = size === "sm" ? "w-10 h-10 text-lg" : size === "lg" ? "w-20 h-20 text-4xl" : "w-14 h-14 text-2xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${sz} rounded-full flex items-center justify-center border-2`}
        style={{ background: `${badge.color}22`, borderColor: badge.color, boxShadow: `0 0 12px ${badge.color}55` }}>
        <span>{badge.icon}</span>
      </div>
      {size !== "sm" && <span className="text-xs font-bold text-center" style={{ color: badge.color }}>{badge.name}</span>}
    </div>
  );
}

function TeamCard({ team, onClick }) {
  const earnedBadges = BADGES.filter(b => team.badges?.includes(b.id));
  return (
    <div onClick={onClick} className="bg-gray-900 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-yellow-400 transition-all"
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(250,204,21,0.15)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl bg-gray-800 border border-gray-600">{team.icon || "🎮"}</div>
        <div>
          <h3 className="font-bold text-white text-sm">{team.name}</h3>
          <p className="text-gray-400 text-xs">Cap: {team.captain}</p>
        </div>
        <div className={`ml-auto px-2 py-1 rounded text-xs font-bold ${team.status === "approved" ? "bg-green-900 text-green-400" : team.status === "rejected" ? "bg-red-900 text-red-400" : "bg-yellow-900 text-yellow-400"}`}>
          {team.status === "approved" ? "✓ Aprobado" : team.status === "rejected" ? "✗ Rechazado" : "⏳ Pendiente"}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        {team.members?.map((m, i) => <span key={i} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">{m.name} ({m.grade})</span>)}
      </div>
      {earnedBadges.length > 0 && <div className="flex gap-2 mt-2">{earnedBadges.map(b => <Badge key={b.id} badge={b} size="sm" />)}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-gray-300 text-sm mb-1 font-medium">{label}</label>}
      <input {...props} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none text-sm" />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-gray-300 text-sm mb-1 font-medium">{label}</label>}
      <select {...props} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-400 focus:outline-none text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c14" }}>
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">⚡</div>
        <p className="text-yellow-400 font-black tracking-widest text-sm">CARGANDO TORNEO...</p>
        <p className="text-gray-600 text-xs mt-2">Conectando con el servidor</p>
      </div>
    </div>
  );
}

// =========== PAGES ===========

function HomePage({ teams, soloPlayers, brackets, settings, setPage }) {
  const approvedTeams = teams.filter(t => t.status === "approved");
  const playedMatches = brackets.rounds?.flatMap(r => r.matches?.filter(m => m.winner)) || [];

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl mb-8 p-8 text-center" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        border: "1px solid rgba(250,204,21,0.3)", boxShadow: "0 0 60px rgba(250,204,21,0.1)"
      }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(250,204,21,0.1) 40px, rgba(250,204,21,0.1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(250,204,21,0.1) 40px, rgba(250,204,21,0.1) 41px)"
        }}></div>
        <div className="relative z-10">
          <div className="inline-block mb-3 px-4 py-1 rounded-full text-xs font-bold tracking-widest" style={{ background: "rgba(250,204,21,0.15)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" }}>
            ⚡ TORNEO OFICIAL 2025
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-2" style={{ textShadow: "0 0 40px rgba(250,204,21,0.5)", letterSpacing: "-1px" }}>
            {settings.tournamentName}
          </h1>
          <p className="text-yellow-400 text-lg font-bold mb-6 tracking-widest">{settings.tournamentSubtitle}</p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <div className="bg-gray-900/80 border border-yellow-400/30 rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-black text-yellow-400">{approvedTeams.length}</div>
              <div className="text-gray-400 text-xs tracking-wide">EQUIPOS INSCRITOS</div>
            </div>
            <div className="bg-gray-900/80 border border-purple-400/30 rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-black text-purple-400">{soloPlayers.length}</div>
              <div className="text-gray-400 text-xs tracking-wide">SIN EQUIPO</div>
            </div>
            <div className="bg-gray-900/80 border border-green-400/30 rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-black text-green-400">{playedMatches.length}</div>
              <div className="text-gray-400 text-xs tracking-wide">PARTIDAS JUGADAS</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setPage("register")} className="px-8 py-3 rounded-xl font-black text-gray-900 text-sm tracking-wider transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)", boxShadow: "0 0 20px rgba(250,204,21,0.4)" }}>
              ⚡ INSCRIBIRSE AHORA
            </button>
            <button onClick={() => setPage("bracket")} className="px-8 py-3 rounded-xl font-bold text-white text-sm border border-gray-600 hover:border-yellow-400 transition-all">
              🏆 VER BRACKET
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <section>
          <h2 className="text-lg font-black text-white mb-4">📋 REGLAS BÁSICAS</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
            {[["⚔️","Equipos de 3 jugadores"],["🏫","Solo alumnos de secundaria"],["🎮","Modalidad: Eliminación directa"],["⏱️","30 min por enfrentamiento"],["📱","Cuenta propia obligatoria"],["🤝","Respeto ante todo"]].map(([icon, rule]) => (
              <div key={rule} className="flex items-center gap-3 text-gray-300 text-sm"><span className="w-6">{icon}</span><span>{rule}</span></div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-black text-white mb-4">🏆 PREMIOS</h2>
          <div className="space-y-3">
            {[
              { pos: "1er Lugar", icon: "🥇", prizes: ["Trofeo oficial", "Insignia Campeón"], color: "#facc15" },
              { pos: "2do Lugar", icon: "🥈", prizes: ["Medalla plata", "Insignia Finalista"], color: "#94a3b8" },
              { pos: "3er Lugar", icon: "🥉", prizes: ["Medalla bronce", "Insignia Semifinalista"], color: "#b45309" },
            ].map(p => (
              <div key={p.pos} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: p.color }}>{p.pos}</p>
                  <div className="flex gap-2 flex-wrap mt-1">{p.prizes.map(pr => <span key={pr} className="text-xs text-gray-400">{pr}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-black text-white mb-4">📅 FECHAS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { date: "1–7 Jul", event: "Inscripciones", icon: "📝", active: true },
            { date: "8 Jul", event: "Sorteo Bracket", icon: "🎲" },
            { date: "10–14 Jul", event: "Fase de Grupos", icon: "⚔️" },
            { date: "18 Jul", event: "Gran Final", icon: "🏆" },
          ].map(s => (
            <div key={s.event} className={`bg-gray-900 rounded-xl p-4 text-center border ${s.active ? "border-yellow-400/50" : "border-gray-700"}`}
              style={s.active ? { boxShadow: "0 0 15px rgba(250,204,21,0.1)" } : {}}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-xs font-bold mb-1 ${s.active ? "text-yellow-400" : "text-gray-400"}`}>{s.date}</div>
              <div className="text-white text-xs font-medium">{s.event}</div>
              {s.active && <div className="mt-2 px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs rounded-full font-bold">ACTIVO</div>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black text-white mb-4">🎖️ INSIGNIAS</h2>
        <div className="flex flex-wrap gap-6 bg-gray-900 border border-gray-700 rounded-xl p-6 justify-center">
          {BADGES.map(b => <Badge key={b.id} badge={b} size="md" />)}
        </div>
      </section>
    </div>
  );
}

function RegisterPage({ setPage }) {
  const [mode, setMode] = useState("team");
  const [form, setForm] = useState({ teamName: "", icon: "🎮", captain: "", captainGrade: "1ro", captainContact: "", member1: "", member1Grade: "1ro", member2: "", member2Grade: "1ro", member3: "", member3Grade: "1ro", accepted: false });
  const [soloForm, setSoloForm] = useState({ name: "", grade: "1ro", contact: "" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const ICONS = ["🎮","⚡","🔥","💎","👑","🦁","🐺","🦊","🎯","🛡️","⚔️","💥"];

  const handleTeamSubmit = async () => {
    if (!form.teamName || !form.captain || !form.member1 || !form.member2 || !form.member3 || !form.accepted) { alert("Completa todos los campos y acepta las reglas."); return; }
    setSaving(true);
    const team = {
      id: Date.now().toString(), name: form.teamName, icon: form.icon, captain: form.captain,
      captainGrade: form.captainGrade, contact: form.captainContact,
      members: [{ name: form.captain, grade: form.captainGrade }, { name: form.member1, grade: form.member1Grade }, { name: form.member2, grade: form.member2Grade }, { name: form.member3, grade: form.member3Grade }],
      status: "pending", badges: ["participant"], wins: 0, losses: 0, matchHistory: [],
      createdAt: new Date().toLocaleDateString("es-PE"),
    };
    await db.addTeam(team);
    setSaving(false);
    setSubmitted(true);
  };

  const handleSoloSubmit = async () => {
    if (!soloForm.name || !soloForm.contact) { alert("Completa todos los campos."); return; }
    setSaving(true);
    await db.addSolo({ id: Date.now().toString(), ...soloForm });
    setSaving(false);
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-3xl font-black text-white mb-2">¡Inscripción Exitosa!</h2>
      <p className="text-gray-400 mb-6">{mode === "team" ? "Tu equipo fue enviado para aprobación. ¡Espera confirmación!" : "Fuiste agregado a la lista. El admin te asignará un equipo."}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { setSubmitted(false); setPage("home"); }} className="px-6 py-2 rounded-xl bg-yellow-400 text-gray-900 font-bold text-sm">← Inicio</button>
        <button onClick={() => setSubmitted(false)} className="px-6 py-2 rounded-xl border border-gray-600 text-white text-sm">Registrar otro</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-white mb-6">📝 INSCRIPCIÓN</h1>
      <div className="flex gap-3 mb-6">
        <button onClick={() => setMode("team")} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === "team" ? "bg-yellow-400 text-gray-900" : "bg-gray-800 text-gray-300 border border-gray-700"}`}>👥 Tengo equipo</button>
        <button onClick={() => setMode("solo")} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === "solo" ? "bg-purple-500 text-white" : "bg-gray-800 text-gray-300 border border-gray-700"}`}>🙋 Sin equipo</button>
      </div>

      {mode === "team" ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4 text-sm tracking-wider">DATOS DEL EQUIPO</h3>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2 font-medium">Ícono del equipo</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => <button key={ic} onClick={() => setForm({ ...form, icon: ic })} className={`w-10 h-10 rounded-lg text-xl transition-all ${form.icon === ic ? "bg-yellow-400/20 border-2 border-yellow-400" : "bg-gray-800 border border-gray-600"}`}>{ic}</button>)}
            </div>
          </div>
          <Input label="Nombre del equipo *" value={form.teamName} onChange={e => setForm({ ...form, teamName: e.target.value })} placeholder="Ej: Los Invencibles" />
          <h3 className="text-white font-bold mb-4 mt-2 text-sm tracking-wider border-t border-gray-700 pt-4">CAPITÁN</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre del capitán *" value={form.captain} onChange={e => setForm({ ...form, captain: e.target.value })} placeholder="Nombre completo" />
            <Select label="Grado" value={form.captainGrade} onChange={e => setForm({ ...form, captainGrade: e.target.value })} options={GRADES.map(g => ({ value: g, label: g }))} />
          </div>
          <Input label="Contacto (WhatsApp / correo) *" value={form.captainContact} onChange={e => setForm({ ...form, captainContact: e.target.value })} placeholder="+51 999 000 111" />
          <h3 className="text-white font-bold mb-4 mt-2 text-sm tracking-wider border-t border-gray-700 pt-4">INTEGRANTES</h3>
          {[1,2,3].map(n => (
            <div key={n} className="grid grid-cols-2 gap-3">
              <Input label={`Integrante ${n} *`} value={form[`member${n}`]} onChange={e => setForm({ ...form, [`member${n}`]: e.target.value })} placeholder="Nombre" />
              <Select label="Grado" value={form[`member${n}Grade`]} onChange={e => setForm({ ...form, [`member${n}Grade`]: e.target.value })} options={GRADES.map(g => ({ value: g, label: g }))} />
            </div>
          ))}
          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <input type="checkbox" checked={form.accepted} onChange={e => setForm({ ...form, accepted: e.target.checked })} className="mt-1 w-4 h-4 rounded" />
            <span className="text-gray-300 text-sm">Acepto las reglas del torneo y me comprometo a competir con respeto y fairplay.</span>
          </label>
          <button onClick={handleTeamSubmit} disabled={saving} className="w-full mt-6 py-3 rounded-xl font-black text-gray-900 tracking-wider transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)" }}>
            {saving ? "Guardando..." : "⚡ INSCRIBIR EQUIPO"}
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-purple-700/40 rounded-2xl p-6">
          <p className="text-gray-400 text-sm mb-6 bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">🙋 Entrarás a una lista especial. El administrador te asignará a un equipo automáticamente.</p>
          <Input label="Tu nombre *" value={soloForm.name} onChange={e => setSoloForm({ ...soloForm, name: e.target.value })} placeholder="Nombre completo" />
          <Select label="Grado" value={soloForm.grade} onChange={e => setSoloForm({ ...soloForm, grade: e.target.value })} options={GRADES.map(g => ({ value: g, label: g }))} />
          <Input label="Contacto *" value={soloForm.contact} onChange={e => setSoloForm({ ...soloForm, contact: e.target.value })} placeholder="+51 999 000 111" />
          <button onClick={handleSoloSubmit} disabled={saving} className="w-full mt-4 py-3 rounded-xl font-black text-white tracking-wider disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
            {saving ? "Guardando..." : "🙋 UNIRME A LA LISTA"}
          </button>
        </div>
      )}
    </div>
  );
}

function TeamsPage({ teams }) {
  const [filter, setFilter] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const filtered = teams.filter(t => filter === "all" || t.status === filter);

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">👥 EQUIPOS</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all","approved","pending","rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f ? "bg-yellow-400 text-gray-900" : "bg-gray-800 text-gray-300 border border-gray-700"}`}>
            {f === "all" ? `Todos (${teams.length})` : f === "approved" ? `Aprobados (${teams.filter(t=>t.status==="approved").length})` : f === "pending" ? `Pendientes (${teams.filter(t=>t.status==="pending").length})` : `Rechazados (${teams.filter(t=>t.status==="rejected").length})`}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">🎮</div><p>No hay equipos aquí</p></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(team => <TeamCard key={team.id} team={team} onClick={() => setSelectedTeam(team)} />)}
        </div>
      )}
      {selectedTeam && (
        <Modal title={`${selectedTeam.icon} ${selectedTeam.name}`} onClose={() => setSelectedTeam(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg p-3"><p className="text-gray-400 text-xs mb-1">VICTORIAS</p><p className="text-2xl font-black text-green-400">{selectedTeam.wins}</p></div>
              <div className="bg-gray-800 rounded-lg p-3"><p className="text-gray-400 text-xs mb-1">DERROTAS</p><p className="text-2xl font-black text-red-400">{selectedTeam.losses}</p></div>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-2 font-bold">INTEGRANTES</p>
              {selectedTeam.members?.map((m, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-yellow-400">{m.name?.[0]}</div>
                  <div><p className="text-white text-sm">{m.name}</p><p className="text-gray-500 text-xs">{m.grade} · {i === 0 ? "Capitán" : `Integrante ${i}`}</p></div>
                </div>
              ))}
            </div>
            {selectedTeam.badges?.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-3 font-bold">INSIGNIAS</p>
                <div className="flex gap-4 flex-wrap">{BADGES.filter(b => selectedTeam.badges?.includes(b.id)).map(b => <Badge key={b.id} badge={b} />)}</div>
              </div>
            )}
            <p className="text-gray-500 text-xs">Contacto: {selectedTeam.contact || "—"}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BracketPage({ teams, brackets, setBrackets, isAdmin }) {
  const approvedTeams = teams.filter(t => t.status === "approved");

  const generateBracket = async () => {
    if (approvedTeams.length < 2) { alert("Se necesitan al menos 2 equipos aprobados."); return; }
    const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
    const size = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const seeded = [...shuffled];
    while (seeded.length < size) seeded.push(null);
    const matches = [];
    for (let i = 0; i < size; i += 2) matches.push({ id: `r1-${i}`, team1: seeded[i], team2: seeded[i+1], winner: null, round: 1 });
    const rounds = [{ round: 1, matches }];
    let prevMatches = matches; let round = 2;
    while (prevMatches.length > 1) {
      const nextMatches = [];
      for (let i = 0; i < prevMatches.length; i += 2) nextMatches.push({ id: `r${round}-${i}`, team1: null, team2: null, winner: null, round, tbd: true });
      rounds.push({ round, matches: nextMatches });
      prevMatches = nextMatches; round++;
    }
    await db.saveBrackets(rounds);
    setBrackets({ rounds });
  };

  const setWinner = async (roundIdx, matchIdx, winner) => {
    if (!isAdmin) return;
    const newRounds = JSON.parse(JSON.stringify(brackets.rounds));
    const match = newRounds[roundIdx].matches[matchIdx];
    match.winner = winner;
    if (roundIdx + 1 < newRounds.length) {
      const nextMatchIdx = Math.floor(matchIdx / 2);
      const isSlot1 = matchIdx % 2 === 0;
      const nextMatch = newRounds[roundIdx + 1].matches[nextMatchIdx];
      if (isSlot1) nextMatch.team1 = winner; else nextMatch.team2 = winner;
      nextMatch.tbd = false;
    }
    await db.saveBrackets(newRounds);
    setBrackets({ rounds: newRounds });
  };

  const roundNames = ["Primera Ronda","Cuartos de Final","Semifinal","Final"];

  if (!brackets.rounds || brackets.rounds.length === 0) return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">🏆</div>
      <h2 className="text-2xl font-black text-white mb-2">Bracket del Torneo</h2>
      <p className="text-gray-400 mb-6">{approvedTeams.length} equipos aprobados. {isAdmin ? "Genera el bracket para comenzar." : "El bracket aún no ha sido generado."}</p>
      {isAdmin && approvedTeams.length >= 2 && (
        <button onClick={generateBracket} className="px-8 py-3 rounded-xl font-black text-gray-900" style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)" }}>🎲 GENERAR BRACKET</button>
      )}
    </div>
  );

  const lastRound = brackets.rounds[brackets.rounds.length - 1];
  const champion = lastRound?.matches?.[0]?.winner;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white">🏆 BRACKET</h1>
        {isAdmin && <button onClick={generateBracket} className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-400 hover:bg-red-900/20">🔄 Regenerar</button>}
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {brackets.rounds.map((round, ri) => (
            <div key={ri} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <span className="text-xs font-bold tracking-wider text-gray-400 bg-gray-800 px-3 py-1 rounded-full">{roundNames[ri] || `Ronda ${ri+1}`}</span>
              </div>
              <div className="flex flex-col" style={{ gap: `${Math.pow(2, ri) * 8}px` }}>
                {round.matches.map((match, mi) => (
                  <div key={match.id} className="w-48">
                    {[match.team1, match.team2].map((team, ti) => (
                      <div key={ti} onClick={() => isAdmin && team && !match.winner && setWinner(ri, mi, team)}
                        className={`flex items-center gap-2 px-3 py-2 border text-sm transition-all ${!team ? "border-gray-700/50 bg-gray-900/50" : match.winner?.id === team?.id ? "border-yellow-400 bg-yellow-400/10" : match.winner ? "border-gray-700 bg-gray-900 opacity-50" : "border-gray-600 bg-gray-900 hover:border-yellow-400/50 cursor-pointer"} ${ti === 0 ? "rounded-t-lg border-b-0" : "rounded-b-lg"}`}>
                        <span className="text-base w-6">{team?.icon || "—"}</span>
                        <span className={`flex-1 truncate text-xs font-medium ${match.winner?.id === team?.id ? "text-yellow-400 font-bold" : team ? "text-white" : "text-gray-600"}`}>
                          {team?.name || (match.tbd ? "Por definir" : "BYE")}
                        </span>
                        {match.winner?.id === team?.id && <span className="text-yellow-400 text-xs">✓</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {champion && (
            <div className="flex flex-col items-center justify-center">
              <div className="text-center mb-2"><span className="text-xs font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/30">CAMPEÓN</span></div>
              <div className="w-36 bg-yellow-400/10 border-2 border-yellow-400 rounded-xl p-4 text-center" style={{ boxShadow: "0 0 20px rgba(250,204,21,0.3)" }}>
                <div className="text-4xl mb-1">{champion.icon}</div>
                <div className="text-yellow-400 font-black text-sm">{champion.name}</div>
                <div className="text-3xl mt-1">👑</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isAdmin && <p className="text-gray-600 text-xs mt-4 text-center">💡 Admin: haz clic en un equipo para marcarlo como ganador</p>}
    </div>
  );
}

function SoloPlayersPage({ soloPlayers, teams, isAdmin }) {
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formTeam = async () => {
    if (selected.length < 2) { alert("Selecciona al menos 2 jugadores."); return; }
    if (!groupName) { alert("Ingresa nombre del equipo."); return; }
    const players = soloPlayers.filter(p => selected.includes(p.id));
    const team = {
      id: Date.now().toString(), name: groupName, icon: "🎮",
      captain: players[0]?.name || "", captainGrade: players[0]?.grade || "",
      contact: players[0]?.contact || "",
      members: players.slice(0, 3).map(p => ({ name: p.name, grade: p.grade })),
      status: "pending", badges: ["participant"], wins: 0, losses: 0, matchHistory: [],
      createdAt: new Date().toLocaleDateString("es-PE"),
    };
    await db.addTeam(team);
    for (const id of selected) await db.deleteSolo(id);
    setSelected([]); setGroupName("");
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">🙋 SIN EQUIPO</h1>
      <p className="text-gray-400 text-sm mb-6">Jugadores esperando ser asignados a un equipo.</p>
      {soloPlayers.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">🙋</div><p>No hay jugadores sin equipo</p></div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {soloPlayers.map(player => (
              <div key={player.id} className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 transition-all ${selected.includes(player.id) ? "border-purple-400 bg-purple-900/10" : player.isSubstitute ? "border-orange-700/40" : "border-gray-700"}`}>
                {isAdmin && <input type="checkbox" checked={selected.includes(player.id)} onChange={() => toggleSelect(player.id)} className="w-4 h-4 rounded" />}
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-black text-purple-400">{player.name?.[0]}</div>
                <div className="flex-1"><p className="text-white font-bold text-sm">{player.name}</p><p className="text-gray-400 text-xs">{player.grade} · {player.contact}</p></div>
                <div className="flex gap-2">
                  {isAdmin && <button onClick={() => db.updateSolo(player.id, { isSubstitute: !player.isSubstitute })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${player.isSubstitute ? "bg-orange-900/40 text-orange-400 border border-orange-700/40" : "bg-gray-800 text-gray-400 border border-gray-600"}`}>
                    {player.isSubstitute ? "Suplente ✓" : "Suplente"}
                  </button>}
                  {isAdmin && <button onClick={() => db.deleteSolo(player.id)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>}
                  {!isAdmin && <span className={`px-2 py-0.5 text-xs rounded font-bold ${player.isSubstitute ? "bg-orange-900/40 text-orange-400" : "bg-purple-900/40 text-purple-400"}`}>{player.isSubstitute ? "Suplente" : "Libre"}</span>}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && selected.length > 0 && (
            <div className="bg-gray-900 border border-purple-700/40 rounded-xl p-4 flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-gray-300 text-sm mb-1">Nombre del nuevo equipo</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej: Los Agrupados"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-400 focus:outline-none" />
              </div>
              <button onClick={formTeam} className="px-5 py-2 rounded-xl font-bold text-white text-sm" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>
                Formar equipo ({selected.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnnouncementsPage({ announcements, isAdmin }) {
  const [form, setForm] = useState({ title: "", message: "", type: "news" });
  const typeConfig = {
    news: { icon: "📌", color: "#818cf8", label: "Noticia" },
    result: { icon: "🏆", color: "#4ade80", label: "Resultado" },
    mvp: { icon: "⭐", color: "#facc15", label: "MVP" },
    upcoming: { icon: "📅", color: "#fb923c", label: "Próxima partida" },
  };

  const addAnnouncement = async () => {
    if (!form.title || !form.message) return;
    await db.addAnnouncement({ id: Date.now().toString(), ...form, date: new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) });
    setForm({ title: "", message: "", type: "news" });
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">📢 ANUNCIOS</h1>
      {isAdmin && (
        <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl p-5 mb-8">
          <h3 className="text-yellow-400 font-bold text-sm mb-4">+ NUEVO ANUNCIO</h3>
          <Input label="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título del anuncio" />
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1 font-medium">Mensaje</label>
            <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Escribe el anuncio..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none text-sm h-20 resize-none" />
          </div>
          <div className="flex gap-2 mb-4">
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <button key={key} onClick={() => setForm({ ...form, type: key })}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.type === key ? "bg-yellow-400/20 border border-yellow-400/50 text-yellow-400" : "bg-gray-800 border border-gray-700 text-gray-400"}`}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
          <button onClick={addAnnouncement} className="w-full py-2.5 rounded-xl font-bold text-gray-900 text-sm" style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)" }}>
            📢 PUBLICAR
          </button>
        </div>
      )}
      <div className="space-y-4">
        {announcements.slice().reverse().map(ann => {
          const cfg = typeConfig[ann.type] || typeConfig.news;
          return (
            <div key={ann.id} className="bg-gray-900 border border-gray-700 rounded-xl p-5" style={{ borderLeft: `4px solid ${cfg.color}` }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{cfg.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-sm">{ann.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${cfg.color}22`, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{ann.message}</p>
                  <p className="text-gray-500 text-xs mt-2">{ann.date}</p>
                </div>
                {isAdmin && <button onClick={() => db.deleteAnnouncement(ann.id)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>}
              </div>
            </div>
          );
        })}
        {announcements.length === 0 && <div className="text-center py-16 text-gray-500"><div className="text-5xl mb-3">📢</div><p>No hay anuncios aún</p></div>}
      </div>
    </div>
  );
}

function AdminPage({ teams, soloPlayers, settings, refetch }) {
  const [tab, setTab] = useState("teams");
  const [settingsForm, setSettingsForm] = useState(settings);

  const approveTeam = (id) => db.updateTeam(id, { status: "approved" });
  const rejectTeam = (id) => db.updateTeam(id, { status: "rejected" });
  const deleteTeam = (id) => { if (confirm("¿Eliminar equipo?")) db.deleteTeam(id); };

  const grantBadge = (team, badgeId) => {
    const badges = team.badges || [];
    const newBadges = badges.includes(badgeId) ? badges.filter(b => b !== badgeId) : [...badges, badgeId];
    db.updateTeam(team.id, { badges: newBadges });
  };

  const saveSettings = async () => {
    await db.saveSettings(settingsForm);
    alert("Configuración guardada ✓");
  };

  const tabs = [
    { id: "teams", label: "Equipos", icon: "👥" },
    { id: "solo", label: "Sin Equipo", icon: "🙋" },
    { id: "badges", label: "Insignias", icon: "🎖️" },
    { id: "settings", label: "Config", icon: "⚙️" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="px-3 py-1 bg-red-900/40 border border-red-700/40 rounded-full text-red-400 text-xs font-bold">🔒 ADMIN</div>
        <h1 className="text-2xl font-black text-white">PANEL DE ADMINISTRACIÓN</h1>
      </div>
      <div className="flex gap-2 mb-6 bg-gray-900 border border-gray-700 rounded-xl p-1.5 flex-wrap">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? "bg-yellow-400 text-gray-900" : "text-gray-400 hover:text-white"}`}>{t.icon} {t.label}</button>)}
      </div>

      {tab === "teams" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {["pending","approved","rejected"].map(s => (
              <div key={s} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
                <div className={`text-2xl font-black ${s==="approved"?"text-green-400":s==="rejected"?"text-red-400":"text-yellow-400"}`}>{teams.filter(t=>t.status===s).length}</div>
                <div className="text-gray-400 text-xs">{s==="pending"?"Pendientes":s==="approved"?"Aprobados":"Rechazados"}</div>
              </div>
            ))}
          </div>
          {teams.map(team => (
            <div key={team.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{team.icon}</span>
                <div className="flex-1"><p className="text-white font-bold text-sm">{team.name}</p><p className="text-gray-400 text-xs">Cap: {team.captain} · {team.createdAt}</p></div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${team.status==="approved"?"bg-green-900/40 text-green-400":team.status==="rejected"?"bg-red-900/40 text-red-400":"bg-yellow-900/40 text-yellow-400"}`}>
                  {team.status==="approved"?"✓ Aprobado":team.status==="rejected"?"✗ Rechazado":"⏳ Pendiente"}
                </span>
              </div>
              <div className="text-gray-400 text-xs mb-3">{team.members?.map(m => m.name).join(", ")}</div>
              <div className="flex gap-2 flex-wrap">
                {team.status !== "approved" && <button onClick={() => approveTeam(team.id)} className="px-3 py-1.5 bg-green-900/40 border border-green-700/40 text-green-400 rounded-lg text-xs font-bold">✓ Aprobar</button>}
                {team.status !== "rejected" && <button onClick={() => rejectTeam(team.id)} className="px-3 py-1.5 bg-red-900/40 border border-red-700/40 text-red-400 rounded-lg text-xs font-bold">✗ Rechazar</button>}
                <button onClick={() => deleteTeam(team.id)} className="px-3 py-1.5 bg-gray-800 border border-gray-600 text-gray-400 rounded-lg text-xs font-bold hover:text-red-400">🗑 Eliminar</button>
              </div>
            </div>
          ))}
          {teams.length === 0 && <p className="text-center text-gray-500 py-8">No hay equipos registrados</p>}
        </div>
      )}

      {tab === "solo" && (
        <div className="space-y-3">
          {soloPlayers.map(player => (
            <div key={player.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-black text-purple-400">{player.name?.[0]}</div>
              <div className="flex-1"><p className="text-white font-bold text-sm">{player.name}</p><p className="text-gray-400 text-xs">{player.grade} · {player.contact}</p></div>
              <div className="flex gap-2">
                <button onClick={() => db.updateSolo(player.id, { isSubstitute: !player.isSubstitute })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${player.isSubstitute ? "bg-orange-900/40 text-orange-400 border border-orange-700/40" : "bg-gray-800 text-gray-400 border border-gray-600"}`}>
                  {player.isSubstitute ? "Suplente ✓" : "Marcar suplente"}
                </button>
                <button onClick={() => db.deleteSolo(player.id)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
          {soloPlayers.length === 0 && <p className="text-center text-gray-500 py-8">No hay jugadores sin equipo</p>}
        </div>
      )}

      {tab === "badges" && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Asigna o revoca insignias a los equipos aprobados.</p>
          {teams.filter(t => t.status === "approved").map(team => (
            <div key={team.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-white font-bold text-sm mb-3">{team.icon} {team.name}</p>
              <div className="flex gap-3 flex-wrap">
                {BADGES.map(badge => {
                  const has = team.badges?.includes(badge.id);
                  return <button key={badge.id} onClick={() => grantBadge(team, badge.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${has ? "" : "border-gray-600 bg-gray-800 text-gray-400 opacity-50"}`}
                    style={has ? { borderColor: badge.color, background: `${badge.color}22`, color: badge.color } : {}}>
                    {badge.icon} {badge.name}
                  </button>;
                })}
              </div>
            </div>
          ))}
          {teams.filter(t => t.status === "approved").length === 0 && <p className="text-center text-gray-500 py-8">No hay equipos aprobados</p>}
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <h3 className="text-white font-bold mb-4">Información del Torneo</h3>
            <Input label="Nombre del torneo" value={settingsForm.tournamentName} onChange={e => setSettingsForm({ ...settingsForm, tournamentName: e.target.value })} />
            <Input label="Subtítulo" value={settingsForm.tournamentSubtitle} onChange={e => setSettingsForm({ ...settingsForm, tournamentSubtitle: e.target.value })} />
            <button onClick={saveSettings} className="px-6 py-2 rounded-xl font-bold text-gray-900 text-sm" style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)" }}>
              💾 Guardar cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========== MAIN APP ===========

export default function App() {
  const { teams, soloPlayers, announcements, brackets, settings, loading, refetch } = useSupabaseData();
  const [setBrackets] = useState(null);
  const [page, setPage] = useState("home");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateBrackets = async (newBrackets) => {
    await db.saveBrackets(newBrackets.rounds);
    await refetch();
  };

  if (loading) return <LoadingScreen />;

  const nav = [
    { id: "home", label: "Inicio", icon: "🏠" },
    { id: "register", label: "Inscripción", icon: "📝" },
    { id: "teams", label: "Equipos", icon: "👥" },
    { id: "bracket", label: "Bracket", icon: "🏆" },
    { id: "solo", label: "Sin Equipo", icon: "🙋" },
    { id: "announcements", label: "Anuncios", icon: "📢" },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: "🔒" }] : []),
  ];

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASSWORD) { setIsAdmin(true); setShowAdminLogin(false); setPage("admin"); }
    else alert("Contraseña incorrecta");
  };

  const commonProps = { teams, soloPlayers, announcements, brackets, settings, isAdmin, setPage, refetch };

  const renderPage = () => {
    switch (page) {
      case "home": return <HomePage {...commonProps} />;
      case "register": return <RegisterPage setPage={setPage} />;
      case "teams": return <TeamsPage teams={teams} />;
      case "bracket": return <BracketPage teams={teams} brackets={brackets} setBrackets={b => updateBrackets(b)} isAdmin={isAdmin} />;
      case "solo": return <SoloPlayersPage soloPlayers={soloPlayers} teams={teams} isAdmin={isAdmin} />;
      case "announcements": return <AnnouncementsPage announcements={announcements} isAdmin={isAdmin} />;
      case "admin": return isAdmin ? <AdminPage teams={teams} soloPlayers={soloPlayers} settings={settings} refetch={refetch} /> : <HomePage {...commonProps} />;
      default: return <HomePage {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#080c14", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <nav className="sticky top-0 z-40 border-b border-gray-800/80 backdrop-blur-md" style={{ background: "rgba(8,12,20,0.95)" }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center h-14">
            <button onClick={() => setPage("home")} className="font-black text-yellow-400 text-sm tracking-wider mr-6 whitespace-nowrap" style={{ textShadow: "0 0 20px rgba(250,204,21,0.5)" }}>
              ⚡ BS TORNEO
            </button>
            <div className="hidden md:flex items-center gap-1 flex-1">
              {nav.map(n => <button key={n.id} onClick={() => setPage(n.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page === n.id ? "bg-yellow-400/15 text-yellow-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                {n.icon} {n.label}
              </button>)}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-green-400 text-xs font-bold hidden md:block">En vivo</span>
              </div>
              {isAdmin ? (
                <button onClick={() => { setIsAdmin(false); setPage("home"); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/40 text-red-400 border border-red-700/40">🔓 Salir Admin</button>
              ) : (
                <button onClick={() => setShowAdminLogin(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500">🔒 Admin</button>
              )}
              <button className="md:hidden text-gray-400 hover:text-white p-1" onClick={() => setMobileOpen(!mobileOpen)}>
                <div className="w-5 h-0.5 bg-current mb-1"></div><div className="w-5 h-0.5 bg-current mb-1"></div><div className="w-5 h-0.5 bg-current"></div>
              </button>
            </div>
          </div>
          {mobileOpen && (
            <div className="md:hidden border-t border-gray-800 py-3 flex flex-wrap gap-1">
              {nav.map(n => <button key={n.id} onClick={() => { setPage(n.id); setMobileOpen(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${page === n.id ? "bg-yellow-400/15 text-yellow-400" : "text-gray-400"}`}>
                {n.icon} {n.label}
              </button>)}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">{renderPage()}</main>

      {showAdminLogin && (
        <Modal title="🔒 Acceso Administrador" onClose={() => setShowAdminLogin(false)}>
          <p className="text-gray-400 text-sm mb-4">Ingresa la contraseña de administrador para continuar.</p>
          <Input label="Contraseña" type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} placeholder="••••••••" />
          <button onClick={handleAdminLogin} className="w-full py-3 rounded-xl font-black text-gray-900" style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)" }}>INGRESAR</button>
        </Modal>
      )}

      <footer className="border-t border-gray-800/50 mt-16 py-6 text-center text-gray-600 text-xs">
        ⚡ {settings.tournamentName} · {settings.tournamentSubtitle} · Sincronizado en tiempo real 🟢
      </footer>
    </div>
  );
}
