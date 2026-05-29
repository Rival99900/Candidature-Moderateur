// candidature/app.js — Discord moderator application form (v3)
// Sends the candidature to a Discord webhook (primary) with FormSubmit + mailto fallbacks.

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  //  📱 MOBILE OPTIMIZATIONS
  // ════════════════════════════════════════════════════════════════════
  // Prevent viewport zoom on input focus (iOS)
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');
    }
  }

  // Improve touch performance
  document.addEventListener('touchmove', function(e) {
    if (e.target.closest('.scrollable')) {
      return;
    }
  }, { passive: true });

  // ════════════════════════════════════════════════════════════════════
  //  ⚙️  CONFIGURATION — lue depuis candidature/config.js
  //
  //  Le webhook + l'email sont définis dans config.js pour pouvoir les
  //  modifier sans toucher au code applicatif.
  //  Note: aucun "secret" client-side n'est vraiment caché — voir config.js.
  // ════════════════════════════════════════════════════════════════════
  const CFG = (window.MORPH_CANDIDATURE_CONFIG || {});
  const DISCORD_WEBHOOK = CFG.DISCORD_WEBHOOK || '';
  const TARGET_EMAIL    = CFG.TARGET_EMAIL    || '';
  const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${TARGET_EMAIL}`;

  const $ = (sel) => document.querySelector(sel);
  const form = $('#cand-form');
  const fields = {
    discord:   $('#f-discord'),
    tiktok:    $('#f-tiktok'),
    dob:       $('#f-dob'),
    situation: $('#f-situation'),
    knew:      $('#f-knew'),
    hours:     $('#f-hours'),
    tz:        $('#f-tz'),
    exp:       $('#f-exp'),
    why_mod:   $('#f-why-mod'),
    why_you:   $('#f-why-you'),
    scenario:  $('#f-scenario'),
    extra:     $('#f-extra'),
  };
  const ageBadge = $('#age-badge');
  const counters = {
    exp:      $('#count-exp'),
    why_mod:  $('#count-why-mod'),
    why_you:  $('#count-why-you'),
    scenario: $('#count-scenario'),
    extra:    $('#count-extra'),
  };
  // For textareas with a minimum length, display "x / min min" until min reached
  const charLimits = {
    exp:      { min: 0,  max: 800 },
    why_mod:  { min: 50, max: 1000 },
    why_you:  { min: 50, max: 1000 },
    scenario: { min: 80, max: 1400 },
    extra:    { min: 0,  max: 1000 },
  };
  // Labels for the select options (used in email subject / PDF)
  const SELECT_LABELS = {
    situation: {
      college: 'Étudiant(e) — collège',
      lycee:   'Étudiant(e) — lycée',
      superieur: 'Étudiant(e) — études supérieures',
      emploi:    'En activité professionnelle',
      recherche: 'En recherche d\'emploi',
      independant: 'Indépendant / freelance',
      autre: 'Autre',
    },
    knew: {
      tiktok: 'TikTok',
      ami: 'Ami / connaissance',
      discord: 'Autre serveur Discord',
      instagram: 'Instagram',
      youtube: 'YouTube',
      twitter: 'X / Twitter',
      recherche: 'Recherche Google',
      autre: 'Autre',
    },
    tz: {
      'fr': 'France / Belgique / Suisse (UTC+1/+2)',
      'maghreb': 'Maghreb — Algérie / Maroc / Tunisie',
      'afrique-ouest': 'Afrique de l\'Ouest',
      'quebec': 'Québec / Canada (UTC-5/-4)',
      'antilles': 'Antilles (UTC-4)',
      'reunion': 'Réunion / Mayotte (UTC+3/+4)',
      'autre': 'Autre',
    },
  };

  const btnEmail = $('#btn-email');
  const btnPdf   = $('#btn-pdf');
  const cardBody = $('#card-body');
  const progressBar = $('#progress-bar');
  const progressCount = $('#progress-count');
  const alertBox = $('#alert');

  const REQUIRED = ['discord','tiktok','dob','situation','knew','hours','tz','exp','why_mod','why_you','scenario'];

  // ════════════════════════════════════════════════════════════════════
  //  🛡️ PROTECTIONS — anti-bot / anti-spam / anti double-envoi
  // ════════════════════════════════════════════════════════════════════
  const PROTECT = {
    hp:        document.querySelector('#hp-website'), // honeypot (champ piège)
    loadedAt:  Date.now(),                            // horodatage de chargement
    minDelayMs: 4000,                                 // un humain met > 4s à remplir
    cooldownMs: 60 * 1000,                            // 60s entre deux envois
    sending:   false,                                 // verrou anti double-clic
    COOLDOWN_KEY: 'morph_candidature_last_send',
  };

  // Nettoie une chaîne : supprime les caractères de contrôle invisibles,
  // normalise les espaces multiples et borne la longueur.
  function sanitize(str, maxLen) {
    if (str == null) return '';
    let s = String(str)
      // retire les caractères de contrôle (sauf \n et \t)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      // retire les caractères de direction/zero-width souvent utilisés pour spoofer
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
      .replace(/[ \t]{3,}/g, '  ')   // limite les longues suites d'espaces
      .replace(/\n{4,}/g, '\n\n\n'); // limite les sauts de ligne en rafale
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  // Renvoie true si l'envoi doit être bloqué par une protection.
  // Affiche un message adapté le cas échéant.
  function isBlockedByProtection() {
    // 1) Honeypot rempli → c'est un bot. On simule un succès silencieux
    //    pour ne pas lui indiquer qu'il a été détecté.
    if (PROTECT.hp && PROTECT.hp.value.trim() !== '') {
      console.warn('🤖 Honeypot déclenché — soumission ignorée.');
      return 'silent';
    }

    // 2) Formulaire soumis trop vite → comportement de bot.
    if (Date.now() - PROTECT.loadedAt < PROTECT.minDelayMs) {
      showAlert(
        'Doucement 🙂',
        'Prends le temps de bien remplir le formulaire avant de l\'envoyer.'
      );
      return 'too-fast';
    }

    // 3) Cooldown anti-spam entre deux envois.
    try {
      const last = Number(sessionStorage.getItem(PROTECT.COOLDOWN_KEY) || 0);
      const wait = PROTECT.cooldownMs - (Date.now() - last);
      if (last && wait > 0) {
        const sec = Math.ceil(wait / 1000);
        showAlert(
          'Candidature déjà envoyée',
          `Tu viens d\'envoyer une candidature. Patiente encore ${sec}s avant d\'en renvoyer une.`
        );
        return 'cooldown';
      }
    } catch {}

    return false;
  }

  function markSent() {
    try { sessionStorage.setItem(PROTECT.COOLDOWN_KEY, String(Date.now())); } catch {}
  }

  // ─── Validation ─────────────────────────────────────────
  function ageFromDob(dobStr) {
    if (!dobStr) return null;
    const d = new Date(dobStr);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }

  function validateField(key) {
    const el = fields[key];
    if (!el) return true;
    el.classList.remove('error');
    const errSlot = document.querySelector(`[data-err-for="${key}"]`);
    if (errSlot) errSlot.textContent = '';
    const v = (el.value || '').trim();

    if (key === 'discord') {
      if (!v) return false;
      if (v.length < 2) return setErr(el, errSlot, 'Pseudo trop court');
      if (v.length > 32) return setErr(el, errSlot, 'Max 32 caractères');
      return true;
    }
    if (key === 'tiktok') {
      if (!v) return false;
      const clean = v.replace(/^@/, '');
      if (clean.length < 2) return setErr(el, errSlot, 'Pseudo trop court');
      if (clean.length > 24) return setErr(el, errSlot, 'Max 24 caractères');
      if (!/^[a-zA-Z0-9._]+$/.test(clean)) return setErr(el, errSlot, 'Caractères invalides');
      return true;
    }
    if (key === 'dob') {
      if (!v) return false;
      const age = ageFromDob(v);
      if (age === null) return setErr(el, errSlot, 'Date invalide');
      if (age < 0) return setErr(el, errSlot, 'Date dans le futur ?');
      if (age > 100) return setErr(el, errSlot, 'Date trop ancienne');
      return true;
    }
    if (key === 'situation' || key === 'knew' || key === 'tz') {
      if (!v) return false;
      return true;
    }
    if (key === 'hours') {
      if (!v) return false;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) return setErr(el, errSlot, 'Au moins 1h/sem');
      if (n > 168) return setErr(el, errSlot, 'Une semaine n\'a que 168h 😉');
      return true;
    }
    if (charLimits[key]) {
      const { min, max } = charLimits[key];
      if (v.length < min) {
        if (v.length === 0 && REQUIRED.includes(key)) return false;
        return setErr(el, errSlot, `Au moins ${min} caractères (actuel : ${v.length})`);
      }
      if (v.length > max) return setErr(el, errSlot, `Trop long (max ${max})`);
      return true;
    }
    return true;
  }
  function setErr(el, slot, msg) {
    el.classList.add('error');
    if (slot) slot.textContent = msg;
    return false;
  }

  function validateAll() {
    let ok = true;
    for (const k of Object.keys(fields)) {
      if (!validateField(k)) ok = false;
    }
    return ok;
  }

  function isFieldFilled(k) {
    const v = (fields[k].value || '').trim();
    if (!v) return false;
    if (k === 'dob') {
      const age = ageFromDob(v);
      return age !== null && age >= 0 && age <= 100;
    }
    if (k === 'hours') {
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 && n <= 168;
    }
    if (charLimits[k] && charLimits[k].min > 0) return v.length >= charLimits[k].min;
    if (k === 'discord' || k === 'tiktok') return v.length >= 2;
    return v.length > 0;
  }

  function updateProgress() {
    let filled = 0;
    for (const k of REQUIRED) if (isFieldFilled(k)) filled++;
    const pct = Math.round((filled / REQUIRED.length) * 100);
    progressBar.style.width = pct + '%';
    progressCount.textContent = filled + '/' + REQUIRED.length;
    const ready = filled === REQUIRED.length;
    btnEmail.disabled = !ready;
    btnPdf.disabled = !ready;
  }

  // ─── Inline bindings ────────────────────────────────────
  function clearErrSlot(k) {
    fields[k].classList.remove('error');
    const slot = document.querySelector(`[data-err-for="${k}"]`);
    if (slot) slot.textContent = '';
  }

  function bindCounter(key) {
    const el = fields[key];
    const counter = counters[key];
    if (!el || !counter) return;
    const update = () => {
      const len = (el.value || '').length;
      const lim = charLimits[key];
      let label;
      if (lim.min > 0 && len < lim.min) label = `${len} / ${lim.min} min`;
      else label = `${len} / ${lim.max}`;
      counter.textContent = label;
      counter.classList.toggle('over', len > lim.max);
      counter.classList.toggle('warn', len > lim.max * 0.85 && len <= lim.max);
    };
    el.addEventListener('input', () => { clearErrSlot(key); update(); updateProgress(); });
    update();
  }

  function bindDob() {
    fields.dob.addEventListener('input', () => {
      const age = ageFromDob(fields.dob.value);
      if (age !== null && age >= 0 && age <= 100) {
        ageBadge.textContent = `${age} an${age > 1 ? 's' : ''}`;
        ageBadge.style.display = 'inline-flex';
        ageBadge.classList.toggle('warn', age < 13);
        if (age < 13) ageBadge.textContent += ' · attention : très jeune';
      } else {
        ageBadge.style.display = 'none';
      }
      clearErrSlot('dob');
      updateProgress();
    });
  }

  function bindSelect(key) {
    fields[key].addEventListener('change', () => {
      // Once user selects, mark as filled so styling differentiates
      fields[key].dataset.empty = fields[key].value ? '0' : '1';
      clearErrSlot(key);
      updateProgress();
    });
  }

  function bindSimple(key) {
    fields[key].addEventListener('input', () => { clearErrSlot(key); updateProgress(); });
  }

  // ─── Collect ────────────────────────────────────────────
  function collectData() {
    const age = ageFromDob(fields.dob.value);
    const dob = new Date(fields.dob.value);
    const dobFmt = dob.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const verified = (window.MorphVerify && window.MorphVerify.getUser()) || null;
    return {
      pseudo_discord:   sanitize(fields.discord.value.trim(), 32),
      pseudo_tiktok:    sanitize(fields.tiktok.value.trim().replace(/^@/, ''), 24),
      date_naissance:   fields.dob.value,
      date_naissance_fr: dobFmt,
      age:              age,
      situation:        SELECT_LABELS.situation[fields.situation.value] || fields.situation.value,
      comment_connu:    SELECT_LABELS.knew[fields.knew.value] || fields.knew.value,
      heures_semaine:   Number(fields.hours.value),
      fuseau:           SELECT_LABELS.tz[fields.tz.value] || fields.tz.value,
      experience:       sanitize(fields.exp.value.trim(), 800),
      pourquoi_moderateur:    sanitize(fields.why_mod.value.trim(), 1000),
      pourquoi_vous_pas_les_autres: sanitize(fields.why_you.value.trim(), 1000),
      scenario:         sanitize(fields.scenario.value.trim(), 1400),
      autres_remarques: sanitize(fields.extra.value.trim(), 1000) || '(rien)',
      submitted_at:     new Date().toISOString(),
      submitted_at_fr:  new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }),
      verified:         verified, // null if verification disabled, else { id, displayName, avatarUrl, ... }
    };
  }

  // Build an email body suitable for a mailto: fallback link
  function buildMailBody(d) {
    return [
      '── PROFIL ─────────────────────────',
      `Pseudo Discord : ${d.pseudo_discord}`,
      `Pseudo TikTok  : @${d.pseudo_tiktok}`,
      `Date de naissance : ${d.date_naissance_fr}  (${d.age} ans)`,
      `Situation : ${d.situation}`,
      `Comment connu : ${d.comment_connu}`,
      '',
      '── DISPONIBILITÉS ──────────────────',
      `${d.heures_semaine} h/sem · ${d.fuseau}`,
      '',
      '── EXPÉRIENCE EN MODÉRATION ────────',
      d.experience,
      '',
      '── POURQUOI MODÉRATEUR ? ───────────',
      d.pourquoi_moderateur,
      '',
      '── POURQUOI MOI ET PAS LES AUTRES ──',
      d.pourquoi_vous_pas_les_autres,
      '',
      '── MISE EN SITUATION ───────────────',
      d.scenario,
      '',
      '── AUTRES REMARQUES ────────────────',
      d.autres_remarques,
      '',
      '──────────────────────────────────────',
      `Envoyé le ${d.submitted_at_fr}`,
    ].join('\n');
  }

  function buildMailtoLink(d) {
    const subject = encodeURIComponent(`Candidature modérateur — ${d.pseudo_discord}`);
    const body = encodeURIComponent(buildMailBody(d));
    return `mailto:${TARGET_EMAIL}?subject=${subject}&body=${body}`;
  }

  // ─── EMAIL via FormSubmit.co ────────────────────────────
  async function submitEmail() {
    hideAlert();

    // 🛡️ Verrou anti double-clic / double-envoi
    if (PROTECT.sending) return;

    if (!validateAll()) return showAlert(
      'Quelques champs ne sont pas remplis',
      'Regarde les champs entourés en rouge plus haut, puis réessaie.'
    );
    // Safety net: if verification is enabled, refuse to send without it.
    if (window.MorphVerify && window.MorphVerify.CLIENT_ID && !window.MorphVerify.isVerified()) {
      return showAlert(
        'Vérification Discord requise',
        'Tu dois te connecter avec ton compte Discord et être membre du serveur avant de pouvoir envoyer ta candidature.'
      );
    }

    // 🛡️ Protections anti-bot / anti-spam
    const blocked = isBlockedByProtection();
    if (blocked === 'silent') {
      // bot détecté : on feint le succès sans rien envoyer
      showSuccess('email', collectData());
      return;
    }
    if (blocked) return;

    PROTECT.sending = true;
    setBtnLoading(btnEmail, true, 'Envoi…');
    const d = collectData();

    console.log('🚀 Début de l\'envoi de la candidature…');
    console.log('📋 Données collectées:', { discord: d.pseudo_discord, tiktok: d.pseudo_tiktok });

    // ── Path A : Discord webhook (PRIORITÉ 1 — essayé EN PREMIER) ─────────────────────────────
    if (DISCORD_WEBHOOK && /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(DISCORD_WEBHOOK)) {
      console.log('🎯 Tentative 1: Envoi via Discord Webhook');
      console.log('🔗 Webhook URL:', DISCORD_WEBHOOK.slice(0, 50) + '...');
      try {
        await sendToDiscord(d);
        console.log('✅ SUCCÈS: Candidature envoyée via Discord Webhook');
        markSent();
        PROTECT.sending = false;
        showSuccess('discord', d);
        return;
      } catch (err) {
        console.error('❌ ERREUR Webhook Discord:', err);
        console.error('📝 Message d\'erreur:', err.message);
        // continue to email
      }
    } else {
      console.warn('⚠️ WEBHOOK NON CONFIGURÉ:', {
        webhook_vide: !DISCORD_WEBHOOK,
        webhook_value: DISCORD_WEBHOOK ? DISCORD_WEBHOOK.slice(0, 50) + '...' : 'VIDE',
        is_valid: /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(DISCORD_WEBHOOK),
      });
    }

    // ── Path B : FormSubmit (PRIORITÉ 2 — fallback email) ──────────────────────────
    console.log('🎯 Tentative 2: Envoi via Email (FormSubmit)');
    try {
      const payload = {
        _subject: `Candidature modérateur — ${d.pseudo_discord}`,
        _template: 'table',
        _captcha: 'false',
        _autoresponse: 'Merci pour ta candidature ! Elle a bien été reçue. Tu auras une réponse rapidement.',
        '👤 Pseudo Discord':   d.pseudo_discord,
        '🎵 Pseudo TikTok':    '@' + d.pseudo_tiktok,
        '🎂 Date de naissance': `${d.date_naissance_fr}  (${d.age} ans)`,
        '🎓 Situation':         d.situation,
        '🔗 Comment connu le serveur': d.comment_connu,
        '⏱️ Disponibilités':    `${d.heures_semaine} h/sem · ${d.fuseau}`,
        '📜 Expérience en modération': d.experience,
        '🛡️ Pourquoi modérateur': d.pourquoi_moderateur,
        '⭐ Pourquoi toi et pas les autres': d.pourquoi_vous_pas_les_autres,
        '🎬 Mise en situation': d.scenario,
        '💬 Autres remarques':  d.autres_remarques,
        '🕒 Envoyé le':         d.submitted_at_fr,
      };

      const res = await fetch(FORMSUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === 'false') throw new Error(json.message || 'Le serveur a refusé la requête');
      console.log('✅ SUCCÈS: Candidature envoyée via Email');
      markSent();
      PROTECT.sending = false;
      showSuccess('email', d);
    } catch (err) {
      console.error('❌ ERREUR Email:', err);
      console.error('📝 Message d\'erreur:', err.message);
      console.error('⚠️ TOUS LES ENVOIS ONT ÉCHOUÉ');
      PROTECT.sending = false;
      setBtnLoading(btnEmail, false, '');
      showFallback(d, err);
    }
  }

  // ─── DISCORD WEBHOOK — Components V2 with smart fallback chain ───────
  //
  // The send chain tries 4 things in order:
  //   1. V2 + CORS         — best case, gives real success/error feedback
  //   2. Classic embed + CORS — V2 might not be enabled on this webhook
  //   3. V2 + no-cors      — bypasses CORS preflight (some iframes block it).
  //                          Response is opaque so we can't verify, but request goes through.
  //   4. Classic + no-cors — last resort, send-and-pray
  //
  // no-cors only works because Discord accepts multipart/form-data which is a
  // "simple" content type. We send the JSON in the `payload_json` form field.
  //
  // ─── DISCORD WEBHOOK — Embed classique (fiable) ─────────────────────
  //
  // L'embed classique est bien plus fiable que les Components V2 via webhook
  // depuis un site statique. On envoie DEUX messages à la suite :
  //   1. L'embed (sans pièce jointe) — c'est le contenu principal.
  //   2. Le PDF seul — il apparaît ainsi SOUS l'embed dans le salon
  //      (Discord affiche les pièces jointes AU-DESSUS de l'embed d'un même
  //       message ; un second message place donc le fichier en dessous).
  //
  // Chaque envoi tente CORS d'abord (réponse lisible), puis no-cors en secours.
  //
  async function sendToDiscord(d) {
    console.log('🔄 Préparation des données Discord…');
    const pdfName = `candidature-${d.pseudo_discord.replace(/[^a-z0-9_-]/gi, '_')}.pdf`;
    let pdfBlob = null;
    try { pdfBlob = await buildPdfBlob(d); console.log('📄 PDF généré avec succès'); } catch (e) { console.warn('⚠️ PDF non généré:', e); }

    // 1) Embed classique SANS fichier (contenu principal) ───────────────
    const embedPayload = buildClassicPayload(d);
    await postWithFallback(embedPayload, null, null, 'Embed classique');

    // 2) PDF dans un SECOND message → s'affiche SOUS l'embed ─────────────
    if (pdfBlob) {
      const filePayload = {
        username: 'Candidatures Modérateur',
        allowed_mentions: { parse: [] },
        attachments: [{ id: 0, filename: pdfName }],
      };
      try {
        await postWithFallback(filePayload, pdfBlob, pdfName, 'PDF (2e message)');
      } catch (err) {
        // L'embed est déjà passé : on n'échoue pas la candidature pour le PDF.
        console.warn('⚠️ PDF non envoyé en second message (embed déjà envoyé):', err.message);
      }
    }
  }

  // Envoie un payload : tente CORS (réponse lisible) puis no-cors (secours).
  async function postWithFallback(payload, pdfBlob, pdfName, label) {
    let lastErr = null;
    for (const mode of ['cors', 'no-cors']) {
      try {
        console.log(`  ↳ ${label} — tentative ${mode}…`);
        await postWebhook(payload, pdfBlob, pdfName, mode);
        console.log(`  ✅ ${label} envoyé (${mode})`);
        return;
      } catch (err) {
        console.warn(`  ❌ ${label} (${mode}) échoué:`, err.message);
        lastErr = err;
      }
    }
    throw lastErr || new Error(`${label} : toutes les tentatives ont échoué`);
  }

  function buildV2Payload(d, pdfBlob, pdfName) {
    // 🧩 COMPONENTS V2 — affichage riche avec File component intégré au container
    // Voir: https://discord.com/developers/docs/components/reference
    //
    // ⚠️ Deux contraintes strictes des Components V2 :
    //   1. Le composant File (type 13) attend un objet imbriqué `file: { url }`
    //      — PAS une propriété `url` au premier niveau (sinon HTTP 400).
    //   2. La somme du texte de TOUS les Text Display ne doit pas dépasser
    //      4000 caractères cumulés (sinon HTTP 400). On tronque + on borne.

    const tr = (s, max) => {
      if (!s || s === '(rien)') return s || '—';
      return s.length <= max ? s : s.slice(0, max - 1) + '…';
    };
    const code = (s) => '```\n' + String(s || '—').replace(/```/g, '`\u200B``') + '\n```';

    // Données de base
    const v = d.verified;
    const isVerified = v && v.id;

    // Construis les composants dans le container
    const innerComponents = [];

    // ── Header ─────────────────────────────
    innerComponents.push({
      type: 10, // TextDisplay
      content: '# 🛡️ Nouvelle candidature modérateur',
    });

    // ── Identity section (si vérifié) ─────
    if (isVerified) {
      innerComponents.push({ type: 14, divider: true, spacing: 1 }); // Separator
      innerComponents.push({
        type: 10,
        content: [
          `## 🔒 Identité vérifiée`,
          `**${v.displayName}**  ·  *@${v.username}*`,
          `Discord ID: \`${v.id}\`  ·  __Membre confirmé__`,
        ].join('\n'),
      });
    }

    // ── Profile section ────────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 2 });
    innerComponents.push({
      type: 10,
      content: [
        `## 👤 Profil`,
        `**Pseudo Discord:** \`${d.pseudo_discord}\``,
        `**Pseudo TikTok:** \`@${d.pseudo_tiktok}\``,
        `**Date de naissance:** ${d.date_naissance_fr} (${d.age} ans)`,
        `**Situation:** ${d.situation}`,
        `**Connu via:** ${d.comment_connu}`,
      ].join('\n'),
    });

    // ── Disponibilités ─────────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    innerComponents.push({
      type: 10,
      content: `## ⏱️ Disponibilités\n**${d.heures_semaine} h/sem** · ${d.fuseau}`,
    });

    // ── Experience ────────────────────────
    // Limites volontairement basses pour rester sous les 4000 car. cumulés.
    // Le PDF joint contient TOUJOURS le texte complet, donc tronquer ici est sans risque.
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    innerComponents.push({
      type: 10,
      content: `### 📜 Expérience en modération\n${code(tr(d.experience, 550))}`,
    });

    // ── Pourquoi modérateur ───────────────
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    innerComponents.push({
      type: 10,
      content: `### 🛡️ Pourquoi modérateur ?\n${code(tr(d.pourquoi_moderateur, 600))}`,
    });

    // ── Pourquoi toi ──────────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    innerComponents.push({
      type: 10,
      content: `### ⭐ Pourquoi toi et pas les autres ?\n${code(tr(d.pourquoi_vous_pas_les_autres, 600))}`,
    });

    // ── Mise en situation ──────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    innerComponents.push({
      type: 10,
      content: `### 🎬 Mise en situation\n${code(tr(d.scenario, 700))}`,
    });

    // ── Autres remarques ───────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 1 });
    const remarques = d.autres_remarques === '(rien)' 
      ? '*(aucune remarque)*'
      : code(tr(d.autres_remarques, 450));
    innerComponents.push({
      type: 10,
      content: `### 💬 Autres remarques\n${remarques}`,
    });

    // ── Footer ─────────────────────────────
    innerComponents.push({ type: 14, divider: true, spacing: 2 });
    innerComponents.push({
      type: 10,
      content: `-# 🕒 Envoyé le ${d.submitted_at_fr}\n-# 📎 Candidature complète en pièce jointe (PDF)`,
    });

    // ── 🛡️ GARDE-FOU 4000 CARACTÈRES ──────
    // Si malgré les troncatures la somme du texte dépasse la limite,
    // on rogne le plus gros Text Display jusqu'à repasser sous le seuil.
    enforceTextBudget(innerComponents, 3900);

    // ════════════════════════════════════════════════════════════
    // Construit le payload Components V2 final
    //
    // ⚠️ Le composant File (type 13) est placé en COMPOSANT DE PREMIER
    //    NIVEAU (frère du Container), PAS à l'intérieur du Container.
    //    Un File imbriqué dans un Container via webhook fait planter
    //    Discord (HTTP 500). En frère du container, ça passe.
    // ════════════════════════════════════════════════════════════
    const topComponents = [
      {
        type: 17, // Container
        accent_color: 0x5865F2,
        components: innerComponents,
      },
    ];
    if (pdfBlob) {
      topComponents.push({
        type: 13, // File Display Component (premier niveau)
        file: { url: `attachment://${pdfName}` },
      });
    }

    return {
      username: 'Candidatures Modérateur',
      flags: 32768, // MessageFlags.IsComponentsV2
      allowed_mentions: { parse: [] },
      components: topComponents,
      attachments: pdfBlob ? [{ id: 0, filename: pdfName }] : [],
    };
  }

  // Rogne au besoin le texte cumulé des Text Display (type 10) pour rester
  // sous la limite Discord de 4000 caractères cumulés des Components V2.
  function enforceTextBudget(components, budget) {
    const texts = components.filter((c) => c && c.type === 10 && typeof c.content === 'string');
    const total = () => texts.reduce((sum, c) => sum + c.content.length, 0);
    let guard = 0; // évite toute boucle infinie
    while (total() > budget && guard++ < 200) {
      // Trouve le plus long Text Display et retire ~80 caractères au bloc de code.
      let longest = texts[0];
      for (const c of texts) if (c.content.length > longest.content.length) longest = c;
      const cut = Math.max(40, Math.ceil((total() - budget) / 2));
      if (longest.content.endsWith('\n```')) {
        // tronque l'intérieur du bloc de code en gardant la fermeture ```
        const body = longest.content.slice(0, -4);
        longest.content = body.slice(0, Math.max(0, body.length - cut)) + '…\n```';
      } else {
        longest.content = longest.content.slice(0, Math.max(0, longest.content.length - cut)) + '…';
      }
    }
  }

  function buildClassicPayload(d) {
    const tr = (s, max) => (!s || s === '(rien)') ? (s || '—') : (s.length <= max ? s : s.slice(0, max - 1) + '…');
    const v = d.verified;
    const embed = {
      author: v
        ? { name: `${v.displayName} · vérifié`, icon_url: v.avatarUrl }
        : { name: '🛡️ **Nouvelle candidature modérateur**' },
      title: d.pseudo_discord,
      color: 0x5865F2,
      thumbnail: v ? { url: v.avatarUrl } : undefined,
      description: [
        v ? `**🔒 Identité Discord :** \`${v.username}\` · ID \`${v.id}\`  __(membre vérifié)__` : null,
        `**Pseudo TikTok :** \`@${d.pseudo_tiktok}\``,
        `**Date de naissance :** __${d.date_naissance_fr}__   *(${d.age} ans)*`,
        `**Situation :** ${d.situation}`,
        `**Connu via :** ${d.comment_connu}`,
        `**Disponibilités :** ${d.heures_semaine} h/sem · ${d.fuseau}`,
      ].filter(Boolean).join('\n'),
      fields: [
        { name: '📜 **Expérience en modération**',         value: '```\n' + tr(d.experience, 950) + '\n```',                    inline: false },
        { name: '🛡️ **Pourquoi modérateur ?**',           value: '```\n' + tr(d.pourquoi_moderateur, 950) + '\n```',           inline: false },
        { name: '⭐ **Pourquoi moi et pas les autres ?**', value: '```\n' + tr(d.pourquoi_vous_pas_les_autres, 950) + '\n```',  inline: false },
        { name: '🎬 **Mise en situation**',                value: '```\n' + tr(d.scenario, 950) + '\n```',                      inline: false },
        { name: '💬 **Autres remarques**',                 value: d.autres_remarques === '(rien)' ? '*(aucune remarque)*' : '```\n' + tr(d.autres_remarques, 950) + '\n```', inline: false },
      ],
      footer: { text: '📎 PDF complet ci-dessous · Candidature Modérateur' },
      timestamp: new Date().toISOString(),
    };
    return {
      username: 'Candidatures Modérateur',
      allowed_mentions: { parse: [] },
      embeds: [embed],
      // Pas de pièce jointe ici : le PDF part dans un second message
      // pour s'afficher SOUS l'embed.
      attachments: [],
    };
  }

  // Posts the webhook. Uses multipart/form-data (a "simple" Content-Type)
  // so we can also use `mode: 'no-cors'` as a CORS-blocked-iframe fallback.
  async function postWebhook(payload, pdfBlob, pdfName, mode) {
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(payload));
    if (pdfBlob) fd.append('files[0]', pdfBlob, pdfName);

    const init = { method: 'POST', body: fd };
    if (mode === 'no-cors') init.mode = 'no-cors';
    const url = DISCORD_WEBHOOK + (mode === 'no-cors' ? '' : '?wait=true');
    const res = await fetch(url, init);

    // In no-cors mode the response is opaque (type === 'opaque', status === 0).
    // We can't read it. If fetch resolved without throwing, the request went out.
    if (mode === 'no-cors') return;

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} — ${errTxt.slice(0, 280)}`);
    }
  }

  // Show a big helpful alert with two backup paths
  function showFallback(d, err) {
    const mailto = buildMailtoLink(d);
    
    // 🐛 Diagnostic info
    const webhookStatus = DISCORD_WEBHOOK 
      ? (DISCORD_WEBHOOK.includes('YOUR') ? '❌ Vide (template)' : '⚠️ Configuré mais échoué')
      : '❌ Non configuré';
    
    const diagnosticInfo = `Webhook: ${webhookStatus} | Erreur: ${(err && err.message) ? err.message : 'réseau'}`;
    
    alertBox.innerHTML = `
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8v5M12 16h.01"/>
      </svg>
      <div style="flex:1">
        <strong>L'envoi automatique n'a pas fonctionné</strong>
        <p>Pas de panique — tu as deux solutions qui marchent à coup sûr :</p>
        <div class="alert-actions">
          <a class="btn btn-primary" href="${mailto}">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 6l-10 7L2 6"/><rect x="2" y="5" width="20" height="14" rx="2"/>
            </svg>
            <span>Ouvrir mon client mail</span>
          </a>
          <button class="btn btn-ghost" id="fallback-pdf">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>
              <path d="M12 18v-6M9 15l3 3 3-3"/>
            </svg>
            <span>Télécharger en PDF</span>
          </button>
        </div>
        <details style="margin-top: 12px; font-size: 11px; opacity: 0.7; cursor: pointer;">
          <summary>📋 Détails techniques (pour le support)</summary>
          <code style="display: block; background: #f0f0f0; padding: 8px; margin-top: 8px; border-radius: 4px; overflow-x: auto;">
            ${diagnosticInfo}
          </code>
          <p style="margin-top: 8px;">
            💡 <strong>Conseil :</strong> Ouvre la console JavaScript (F12) pour voir les détails d'erreur.<br/>
            🔧 Si c'est un problème de configuration, contact l'admin du serveur.
          </p>
        </details>
      </div>`;
    alertBox.style.display = 'flex';
    // Wire up the inline "Télécharger en PDF" button
    const fbBtn = document.getElementById('fallback-pdf');
    if (fbBtn) fbBtn.addEventListener('click', () => { hideAlert(); generatePdf(); });
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ─── PDF ────────────────────────────────────────────────
  let _fontCache = null;
  async function getRobotoBytes() {
    if (_fontCache) return _fontCache;
    const urls = [
      'https://cdn.jsdelivr.net/gh/googlefonts/roboto/src/hinted/Roboto-Regular.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Regular.ttf',
    ];
    for (const url of urls) {
      try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) { _fontCache = await r.arrayBuffer(); return _fontCache; } } catch {}
    }
    throw new Error('Impossible de charger la police');
  }
  let _boldCache = null;
  async function getRobotoBoldBytes() {
    if (_boldCache) return _boldCache;
    const urls = [
      'https://cdn.jsdelivr.net/gh/googlefonts/roboto/src/hinted/Roboto-Bold.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Bold.ttf',
    ];
    for (const url of urls) {
      try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) { _boldCache = await r.arrayBuffer(); return _boldCache; } } catch {}
    }
    throw new Error('Impossible de charger la police (bold)');
  }

  async function generatePdf() {
    hideAlert();
    if (!validateAll()) return showAlert(
      'Quelques champs ne sont pas remplis',
      'Regarde les champs entourés en rouge plus haut, puis réessaie.'
    );
    setBtnLoading(btnPdf, true, 'Génération…');
    try {
      const d = collectData();
      const blob = await buildPdfBlob(d);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidature-${d.pseudo_discord.replace(/[^a-z0-9_-]/gi, '_')}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setBtnLoading(btnPdf, false, '');
      showSuccess('pdf', d);
    } catch (err) {
      console.error(err);
      showAlert('Erreur lors de la génération du PDF', err.message || 'Réessaie ou utilise « Envoyer la candidature ».');
      setBtnLoading(btnPdf, false, '');
    }
  }

  // Builds the candidature PDF and returns a Blob. Reused by Discord attach.
  async function buildPdfBlob(d) {
    const { PDFDocument, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(window.fontkit);
    const fontReg  = await pdf.embedFont(await getRobotoBytes(),     { subset: true });
    const fontBold = await pdf.embedFont(await getRobotoBoldBytes(), { subset: true });

    const pageW = 595, pageH = 842;
    const margin = 60;
    const contentW = pageW - margin * 2;
    let page = pdf.addPage([pageW, pageH]);
    let y = pageH - margin;

    const blurple = rgb(88/255, 101/255, 242/255);
    const ink     = rgb(0.09, 0.08, 0.06);
    const muted   = rgb(0.46, 0.45, 0.42);
    const white   = rgb(1, 1, 1);

    function drawFooter(p) {
      p.drawText('Candidature modérateur · ' + d.pseudo_discord, { x: margin, y: 32, size: 9, font: fontReg, color: muted });
      p.drawText(new Date().toLocaleDateString('fr-FR'), { x: pageW - margin - 60, y: 32, size: 9, font: fontReg, color: muted });
    }
    function ensure(lineH) {
      if (y < margin + 50 + lineH) { drawFooter(page); page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
    }
    function wrap(text, font, size, w) {
      w = w || contentW;
      if (font.widthOfTextAtSize(text, size) <= w) return [text];
      const words = text.split(/(\s+)/);
      const lines = []; let cur = '';
      for (const word of words) {
        const cand = cur + word;
        if (font.widthOfTextAtSize(cand, size) > w && cur) {
          lines.push(cur.replace(/\s+$/, '')); cur = word.replace(/^\s+/, '');
        } else cur = cand;
      }
      if (cur) lines.push(cur);
      return lines;
    }
    function drawText(text, opts) {
      opts = opts || {};
      const f = opts.bold ? fontBold : fontReg;
      const size = opts.size || 11;
      const color = opts.color || ink;
      const lineH = size * 1.45;
      const paras = String(text).split(/\r?\n/);
      for (let i = 0; i < paras.length; i++) {
        const para = paras[i];
        if (para === '') { y -= lineH * 0.6; continue; }
        for (const line of wrap(para, f, size)) {
          ensure(lineH);
          page.drawText(line, { x: margin, y, size, font: f, color });
          y -= lineH;
        }
      }
    }
    function blank(amount) { y -= (amount || 8); }
    function sectionTitle(label) {
      ensure(26);
      page.drawRectangle({ x: margin - 2, y: y - 2, width: 3, height: 13, color: blurple });
      page.drawText(label, { x: margin + 8, y, size: 9.5, font: fontBold, color: muted });
      y -= 18;
    }
    function fieldRow(label, value, opts) {
      opts = opts || {};
      ensure(38);
      drawText(label, { size: 9, bold: true, color: muted });
      blank(2);
      drawText(value || '—', { size: opts.size || 11.5 });
      blank(opts.gap || 14);
    }

    page.drawRectangle({ x: 0, y: pageH - 90, width: pageW, height: 90, color: blurple });
    page.drawText('Candidature Modérateur', { x: margin, y: pageH - 50, size: 22, font: fontBold, color: white });
    page.drawText('Discord Server Application', { x: margin, y: pageH - 72, size: 11, font: fontReg, color: white });
    y = pageH - 120;

    drawText(d.pseudo_discord, { size: 28, bold: true });
    blank(2);
    drawText(`Envoyé le ${d.submitted_at_fr}`, { size: 10, color: muted });
    blank(20);

    sectionTitle('PROFIL');
    fieldRow('Pseudo Discord', d.pseudo_discord);
    fieldRow('Pseudo TikTok',  '@' + d.pseudo_tiktok);
    fieldRow('Date de naissance', `${d.date_naissance_fr}  (${d.age} ans)`);
    fieldRow('Situation actuelle', d.situation);
    fieldRow('Comment a connu le serveur', d.comment_connu);

    blank(8);
    sectionTitle('DISPONIBILITÉS');
    fieldRow('Heures par semaine', `${d.heures_semaine} h/sem`);
    fieldRow('Fuseau horaire', d.fuseau);

    blank(8);
    sectionTitle('EXPÉRIENCE EN MODÉRATION');
    drawText(d.experience, { size: 11.5 });
    blank(18);

    sectionTitle('POURQUOI MODÉRATEUR ?');
    drawText(d.pourquoi_moderateur, { size: 11.5 });
    blank(18);

    sectionTitle('POURQUOI TOI ET PAS LES AUTRES ?');
    drawText(d.pourquoi_vous_pas_les_autres, { size: 11.5 });
    blank(18);

    sectionTitle('MISE EN SITUATION');
    drawText(d.scenario, { size: 11.5 });
    blank(18);

    sectionTitle('AUTRES REMARQUES');
    drawText(d.autres_remarques, { size: 11.5, color: d.autres_remarques === '(rien)' ? muted : ink });
    blank(20);

    drawFooter(page);

    const bytes = await pdf.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  // ─── Helpers ────────────────────────────────────────────
  function setBtnLoading(btn, loading, label) {
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = `<span class="spinner"></span><span>${label}</span>`;
      btn.disabled = true;
    } else {
      if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
      updateProgress();
    }
  }
  function showAlert(title, body) {
    alertBox.innerHTML = `
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8v5M12 16h.01"/>
      </svg>
      <div style="flex:1">
        <strong>${title}</strong>
        <p style="margin:0">${body || ''}</p>
      </div>`;
    alertBox.style.display = 'flex';
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hideAlert() { alertBox.style.display = 'none'; }

  function showSuccess(method, d) {
    const titles = {
      discord: 'Candidature envoyée !',
      email:   'Candidature envoyée !',
      pdf:     'PDF téléchargé !',
    };
    const bodies = {
      discord: `Ta candidature est arrivée directement chez le staff du serveur. Réponse sous quelques jours.`,
      email:   `Ta candidature a bien été envoyée au staff du serveur. Réponse sous quelques jours.`,
      pdf:     `Le fichier <strong>candidature-${d.pseudo_discord}.pdf</strong> a été téléchargé. Envoie-le au staff du serveur via Discord.`,
    };
    cardBody.innerHTML = `
      <div class="success-card">
        <div class="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12l4 4L19 6"/>
          </svg>
        </div>
        <h2>${titles[method] || 'Envoyé !'}</h2>
        <p>${bodies[method] || ''}</p>
        <div class="actions">
          <button class="btn btn-ghost" onclick="location.reload()">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>
            </svg>
            <span>Nouvelle candidature</span>
          </button>
        </div>
      </div>`;
  }

  // ─── Verification gate (Discord OAuth) ────────────────────
  // Subscribes to MorphVerify state changes, renders the appropriate gate
  // panel, and shows/hides the actual form based on verification status.
  const verifySection = $('#verify-section');
  const formSection   = $('#form-section');
  const vbAvatar      = $('#vb-avatar');
  const vbName        = $('#vb-name');
  const vbLogout      = $('#vb-logout');

  // SVG helpers — keep inline so we don't ship icon fonts.
  const DISCORD_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.27 5.33a18.4 18.4 0 0 0-4.49-1.4.07.07 0 0 0-.07.03c-.2.34-.41.79-.56 1.14a17 17 0 0 0-5.1 0 11 11 0 0 0-.57-1.14.07.07 0 0 0-.07-.03 18.36 18.36 0 0 0-4.49 1.4.06.06 0 0 0-.03.02c-2.86 4.27-3.64 8.44-3.26 12.55 0 .02.02.04.04.05a18.45 18.45 0 0 0 5.55 2.81.07.07 0 0 0 .08-.02c.43-.58.8-1.2 1.13-1.85a.07.07 0 0 0-.04-.1 12.1 12.1 0 0 1-1.73-.82.07.07 0 0 1-.01-.12c.12-.09.23-.18.34-.27a.07.07 0 0 1 .07 0c3.62 1.66 7.54 1.66 11.12 0a.07.07 0 0 1 .07 0c.11.09.22.18.34.28a.07.07 0 0 1-.01.12c-.55.32-1.13.6-1.73.82a.07.07 0 0 0-.04.1c.34.65.7 1.27 1.13 1.85a.07.07 0 0 0 .08.02 18.4 18.4 0 0 0 5.56-2.8.07.07 0 0 0 .03-.06c.46-4.74-.77-8.87-3.27-12.55a.06.06 0 0 0-.03-.02zM8.52 15.33c-1.09 0-1.99-1-1.99-2.23 0-1.22.88-2.23 1.99-2.23 1.12 0 2 1.01 1.99 2.23 0 1.23-.88 2.23-1.99 2.23zm7.36 0c-1.09 0-1.98-1-1.98-2.23 0-1.22.87-2.23 1.98-2.23 1.13 0 2 1.01 1.99 2.23 0 1.23-.86 2.23-1.99 2.23z"/></svg>`;
  const WARNING_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.86l-7.4 12.83A2 2 0 0 0 4.6 19.7h14.8a2 2 0 0 0 1.7-3.01L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v5M12 18h.01"/></svg>`;
  const ERROR_SVG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`;
  const CHECK_SVG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>`;

  function renderIdle() {
    return `
      <div class="verify-state">
        <div class="verify-icon">${DISCORD_LOGO_SVG}</div>
        <h2>Vérifie ton compte Discord</h2>
        <p class="lead">
          Pour postuler, on a besoin de s'assurer que tu es bien <strong>membre du serveur</strong>.
          Pas de compte créé, aucun mot de passe à donner juste une autorisation à valider.
        </p>
        <button type="button" class="verify-btn-discord" id="verify-btn-login">
          ${DISCORD_LOGO_SVG}
          <span>Continuer avec Discord</span>
        </button>
        <div class="verify-perks">
          <span class="pk">${CHECK_SVG} Lecture seule</span>
          <span class="pk">${CHECK_SVG} Pas de message envoyé</span>
          <span class="pk">${CHECK_SVG} Déconnexion à tout moment</span>
        </div>
      </div>`;
  }

  function renderVerifying() {
    return `
      <div class="verify-state">
        <div class="verify-icon spin"><div class="vi-ring"></div></div>
        <h2>Vérification en cours…</h2>
        <p class="lead">On regarde si tu es bien membre du serveur. Ça prend une seconde.</p>
      </div>`;
  }

  function renderNotMember(user) {
    const inviteBtn = (window.MorphVerify.INVITE_URL)
      ? `<a class="btn btn-primary btn-sm" href="${window.MorphVerify.INVITE_URL}" target="_blank" rel="noopener">
           ${DISCORD_LOGO_SVG}<span>Rejoindre le serveur</span>
         </a>`
      : '';
    return `
      <div class="verify-state">
        <div class="verify-icon warn">${WARNING_SVG}</div>
        <h2>Tu n'es pas (encore) sur le serveur</h2>
        <p class="lead">
          On peut pas accepter une candidature de quelqu'un qui n'est pas membre du serveur.
          ${user ? `(Compte Discord <strong>${escapeHTML(user.displayName)}</strong> détecté, mais pas dans le serveur.)` : ''}
          <br><br>Rejoins le serveur d'abord, puis reviens ici et clique sur Réessayer.
        </p>
        <div class="verify-buttons">
          ${inviteBtn}
          <button type="button" class="btn btn-ghost btn-sm" id="verify-btn-retry">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>
            <span>Réessayer</span>
          </button>
        </div>
      </div>`;
  }

  function renderError(errorMsg) {
    return `
      <div class="verify-state">
        <div class="verify-icon error">${ERROR_SVG}</div>
        <h2>Erreur de vérification</h2>
        <p class="lead">${escapeHTML(errorMsg || 'Quelque chose s\'est mal passé.')}</p>
        <div class="verify-buttons">
          <button type="button" class="btn btn-primary btn-sm" id="verify-btn-retry">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>
            <span>Réessayer</span>
          </button>
        </div>
      </div>`;
  }

  function renderUnconfigured() {
    const curUri = (window.MorphVerify && window.MorphVerify.REDIRECT_URI) || location.href;
    return `
      <div class="verify-state">
        <div class="verify-icon warn">${WARNING_SVG}</div>
        <h2>Vérification Discord pas encore activée</h2>
        <p class="lead">
          Le staff doit configurer la vérification Discord avant que le formulaire soit utilisable.
        </p>
        <div class="verify-setup">
          <strong>👋 Si tu es le staff :</strong> ouvre <code>candidature/config.js</code> et suis les instructions
          en commentaire. Tu dois créer une application sur le portail développeur Discord et copier
          le <strong>Client ID</strong> + ajouter cette URL en redirect :
          <ol>
            <li>Va sur <code>https://discord.com/developers/applications</code></li>
            <li>« New Application » → onglet « OAuth2 »</li>
            <li>Copie le <code>CLIENT ID</code> dans <code>config.js</code></li>
            <li>Section « Redirects » → ajoute : <code>${escapeHTML(curUri)}</code></li>
            <li>Recharge cette page</li>
          </ol>
        </div>
      </div>`;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function applyVerifyState(s) {
    if (!verifySection || !formSection) return;
    const isVerified = (s.status === 'verified');
    formSection.hidden = !isVerified;
    verifySection.style.display = isVerified ? 'none' : '';

    if (isVerified) {
      // Populate banner
      vbAvatar.src = s.user.avatarUrl;
      vbName.textContent = s.user.displayName + (s.user.username && s.user.username !== s.user.displayName ? ` · @${s.user.username}` : '');
      // Lock the Discord pseudo with the verified handle (use username, not display name,
      // so it matches the server member list exactly).
      fields.discord.value = s.user.username;
      fields.discord.readOnly = true;
      fields.discord.classList.add('locked');
      // Trigger validation/progress
      fields.discord.dispatchEvent(new Event('input'));
      verifySection.innerHTML = '';
      return;
    }

    // Render the right panel for the current state
    let html;
    switch (s.status) {
      case 'unconfigured': html = renderUnconfigured(); break;
      case 'verifying':    html = renderVerifying();    break;
      case 'not-member':   html = renderNotMember(s.user); break;
      case 'error':        html = renderError(s.error || 'Erreur inconnue'); break;
      case 'idle':
      case 'loading':
      default:             html = renderIdle();         break;
    }
    verifySection.innerHTML = html;

    // Wire up buttons in whichever panel we just rendered
    const btnLogin = verifySection.querySelector('#verify-btn-login');
    if (btnLogin) btnLogin.addEventListener('click', () => window.MorphVerify.startLogin());
    const btnRetry = verifySection.querySelector('#verify-btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', () => window.MorphVerify.startLogin());

    // Unlock discord field if we just lost verification
    if (fields.discord.readOnly) {
      fields.discord.readOnly = false;
      fields.discord.classList.remove('locked');
    }
  }

  function bindVerification() {
    if (!window.MorphVerify) {
      // verify.js failed to load — proceed without verification (legacy behaviour)
      formSection.hidden = false;
      verifySection.style.display = 'none';
      return;
    }
    window.MorphVerify.onChange(applyVerifyState);
    // Wire the logout link in the verified banner
    if (vbLogout) {
      vbLogout.addEventListener('click', () => {
        window.MorphVerify.logout();
      });
    }
  }

  // ─── Init ───────────────────────────────────────────────
  function init() {
    bindVerification();
    bindCounter('exp');
    bindCounter('why_mod');
    bindCounter('why_you');
    bindCounter('scenario');
    bindCounter('extra');
    bindDob();
    bindSimple('discord');
    bindSimple('tiktok');
    bindSimple('hours');
    bindSelect('situation');
    bindSelect('knew');
    bindSelect('tz');
    updateProgress();

    btnEmail.addEventListener('click', submitEmail);
    btnPdf.addEventListener('click', generatePdf);

    // DOB bounds
    const today = new Date().toISOString().split('T')[0];
    fields.dob.setAttribute('max', today);
    const minDate = new Date(); minDate.setFullYear(minDate.getFullYear() - 100);
    fields.dob.setAttribute('min', minDate.toISOString().split('T')[0]);

    form.addEventListener('submit', (e) => { e.preventDefault(); submitEmail(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();