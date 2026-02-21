// ═══════════════════════════════════════
// STAKEHOLDERS
// ═══════════════════════════════════════
const STAKEHOLDERS = {
    pm: {
        id: 'pm',
        name: 'Alex Chen',
        role: 'Product Manager',
        emoji: '🧑‍💼',
        color: '#63b3ed',
        roleColor: 'rgba(99,179,237,0.15)',
        roleBorder: 'rgba(99,179,237,0.4)',
    },
    ds: {
        id: 'ds',
        name: 'Maya Patel',
        role: 'Data Scientist',
        emoji: '👩‍🔬',
        color: '#7c6ff7',
        roleColor: 'rgba(124,111,247,0.15)',
        roleBorder: 'rgba(124,111,247,0.4)',
    },
    eng: {
        id: 'eng',
        name: 'Jordan Lee',
        role: 'Engineer',
        emoji: '👨‍💻',
        color: '#3ecf8e',
        roleColor: 'rgba(62,207,142,0.15)',
        roleBorder: 'rgba(62,207,142,0.4)',
    },
    design: {
        id: 'design',
        name: 'Sara Kim',
        role: 'UX Designer',
        emoji: '🎨',
        color: '#f6ad55',
        roleColor: 'rgba(246,173,85,0.15)',
        roleBorder: 'rgba(246,173,85,0.4)',
    },
    growth: {
        id: 'growth',
        name: 'Tom Rivera',
        role: 'Growth Lead',
        emoji: '📈',
        color: '#ed64a6',
        roleColor: 'rgba(237,100,166,0.15)',
        roleBorder: 'rgba(237,100,166,0.4)',
    },
    legal: {
        id: 'legal',
        name: 'Dana Walsh',
        role: 'Legal / Privacy',
        emoji: '⚖️',
        color: '#4fd1c5',
        roleColor: 'rgba(79,209,197,0.15)',
        roleBorder: 'rgba(79,209,197,0.4)',
    },
};

// ═══════════════════════════════════════
// MESSAGES SCRIPT
// ═══════════════════════════════════════
const MESSAGES = [
    // ─── PHASE 1: Idea & Hypothesis ──────
    {
        type: 'phase',
        phase: 'phase1',
        label: 'Phase 1 — Idea & Hypothesis',
    },
    {
        type: 'system',
        text: 'Alex Chen started a new experiment proposal thread.',
    },
    {
        sender: 'pm',
        time: 'Mon 09:02 AM',
        text: "Hey team 👋 I've been looking at our checkout funnel data and our conversion rate is sitting at 5.0%, which is below industry benchmark (~6.5%). I think our current CTA button is getting lost on the page. I want to propose an A/B test — changing the button color from gray to high-contrast orange.",
        reactions: ['👍 3', '🔥 2'],
        deliverable: null,
    },
    {
        sender: 'growth',
        time: 'Mon 09:10 AM',
        text: "Agree — I've seen this on the heatmaps too. The gray button barely registers in session recordings. If we can get even +0.5% absolute conversion lift, that's meaningful revenue at our traffic volume.",
        reactions: ['💯 2'],
        deliverable: null,
    },
    {
        sender: 'design',
        time: 'Mon 09:18 AM',
        text: "I can design both variants. Before we go too far — I'll need to know which user segment we're targeting. Do we want all users, or just mobile?",
        deliverable: null,
    },
    {
        sender: 'pm',
        time: 'Mon 09:22 AM',
        text: "Good question Sara. Let's go with all users for now — desktop and mobile. I'll write up the formal hypothesis and share it here.",
        deliverable: null,
    },
    {
        sender: 'pm',
        time: 'Mon 09:35 AM',
        text: "Okay here's the experiment proposal doc:",
        attachment: {
            type: 'doc',
            label: '📄 Experiment Proposal',
            title: 'Checkout CTA Button — Color Change Test',
            body: `<b>Hypothesis:</b> Changing the checkout CTA button color from gray (#888) to high-contrast orange (#FF6B2B) will increase user clicks and improve checkout conversion rate.<br/><br/><b>Null Hypothesis (H₀):</b> The button color change has no effect on conversion rate.<br/><b>Alternative Hypothesis (H₁):</b> The orange button produces a higher conversion rate than the gray button.<br/><br/><b>Primary Metric:</b> Checkout conversion rate (sessions → purchase)<br/><b>Secondary Metrics:</b> Revenue per user, cart abandonment rate<br/><b>Target Users:</b> All users reaching the checkout page`,
        },
        deliverableCard: {
            from: '🧑‍💼 Alex (PM)',
            name: 'Experiment Proposal Doc',
            desc: 'Hypothesis, metrics, and target users defined',
            color: '#63b3ed',
        },
    },
    {
        sender: 'ds',
        time: 'Mon 09:50 AM',
        text: "Great framing Alex! Before I do the power calculation, two questions: (1) What's the minimum lift that would actually justify shipping this change? (2) Are we okay with a 2-week test, or do we need results faster?",
        reactions: ['🙌 2'],
        deliverable: null,
    },
    {
        sender: 'growth',
        time: 'Mon 09:55 AM',
        text: "From a business perspective — a 0.5% absolute lift (5.0% → 5.5%) is our break-even point for the engineering effort. Anything below that and we'd basically ship it for free and hope for the best.",
        deliverable: null,
    },
    {
        sender: 'pm',
        time: 'Mon 10:00 AM',
        text: "2 weeks is fine. We don't have a major release deadline for 6 weeks, so we have room.",
        deliverable: null,
    },

    // ─── PHASE 2: Test Design ────────────
    {
        type: 'phase',
        phase: 'phase2',
        label: 'Phase 2 — Test Design & Setup',
    },
    {
        sender: 'ds',
        time: 'Mon 11:15 AM',
        text: "Perfect. I've run the sample size calculation. Here's what we need:",
        attachment: {
            type: 'data',
            label: '📊 Sample Size Calculation',
            title: 'Power Analysis Results',
            body: `<b>Inputs:</b><br/>
• Baseline conversion rate: <code>5.0%</code><br/>
• MDE (Minimum Detectable Effect): <code>+0.5% absolute → 10% relative lift</code><br/>
• Significance level (α): <code>0.05 (two-tailed)</code><br/>
• Statistical power: <code>80%</code><br/>
• Test: <code>Two-proportion Z-test</code><br/><br/>
<b>Result:</b><br/>
• Required users per group: <code>~63,500</code><br/>
• Total users needed: <code>~127,000</code><br/>
• Estimated duration: <code>~12–14 days</code> (based on ~10K checkout page visits/day)`,
        },
        deliverableCard: {
            from: '👩‍🔬 Maya (Data Scientist)',
            name: 'Power Analysis Report',
            desc: 'Sample size, duration, α, power, MDE',
            color: '#7c6ff7',
        },
    },
    {
        sender: 'pm',
        time: 'Mon 11:22 AM',
        text: "Great — 2 weeks works. Why Z-test by the way? Just want to make sure I understand when we document this.",
    },
    {
        sender: 'ds',
        time: 'Mon 11:28 AM',
        text: "We're comparing two conversion rates (proportions) with a very large sample size (63K+ per group). With large samples the Central Limit Theorem kicks in and we use the Z-test for proportions. If we were comparing something like average revenue with a smaller sample, we'd use a T-test instead. Here it's clear-cut: proportions + huge sample = Z-test. ✅",
        reactions: ['💡 4'],
    },
    {
        sender: 'legal',
        time: 'Mon 11:45 AM',
        text: "Quick check-in from Legal 👋 — are we randomizing users properly? If there's any segment that includes users under 18 or users in GDPR-jurisdiction countries, we'll need to make sure consent flows are not disrupted by the experiment.",
    },
    {
        sender: 'eng',
        time: 'Mon 11:52 AM',
        text: "Great point Dana. Our experiment platform randomizes by `user_id`, not session, so the same user always sees the same variant. We'll exclude users without a consent cookie from the experiment entirely.",
    },
    {
        sender: 'legal',
        time: 'Mon 11:56 AM',
        text: "Perfect. That works. ✅ I'll note this in the experiment record for compliance.",
        deliverableCard: {
            from: '⚖️ Dana (Legal)',
            name: 'Legal Clearance Note',
            desc: 'GDPR-compliant randomization confirmed; consent users excluded',
            color: '#4fd1c5',
        },
    },
    {
        sender: 'design',
        time: 'Mon 02:00 PM',
        text: "Here are the two variants ready for implementation:",
        attachment: {
            type: 'doc',
            label: '🎨 Design Spec',
            title: 'Variant Designs',
            body: `<b>Control (A):</b> Gray CTA button — <code>#888888</code>, text: "Complete Purchase"<br/><br/><b>Treatment (B):</b> Orange CTA button — <code>#FF6B2B</code>, same text, same font, same size. Only color changes — isolated variable.<br/><br/>✅ Accessibility: Orange variant passes WCAG AA contrast ratio (4.7:1)<br/>✅ Mobile-responsive: Both variants tested on iOS + Android`,
        },
        deliverableCard: {
            from: '🎨 Sara (Designer)',
            name: 'Variant Design Spec',
            desc: 'Control vs Treatment mockups with accessibility check',
            color: '#f6ad55',
        },
    },
    {
        sender: 'eng',
        time: 'Mon 03:30 PM',
        text: "Implementation is done. Here's the technical setup summary:",
        attachment: {
            type: 'doc',
            label: '⚙️ Engineering Setup',
            title: 'Experiment Technical Configuration',
            body: `• <b>Randomization:</b> 50/50 split by <code>user_id</code><br/>
• <b>Platform:</b> Internal experiment platform (flag: <code>checkout_cta_color_v1</code>)<br/>
• <b>Logging:</b> All events tracked via <code>experiment_exposure</code> + <code>checkout_complete</code> events in Snowflake<br/>
• <b>Kill switch:</b> Enabled — can revert to control in 60 seconds if needed<br/>
• <b>Holdout:</b> No holdout group this round<br/>
• <b>AA test:</b> Run overnight — both groups saw identical gray button. No significant difference detected (p = 0.71) ✅`,
        },
        deliverableCard: {
            from: '👨‍💻 Jordan (Engineer)',
            name: 'Technical Setup Doc',
            desc: 'Randomization, logging, kill switch, AA test passed',
            color: '#3ecf8e',
        },
    },
    {
        sender: 'ds',
        time: 'Mon 03:45 PM',
        text: "Nice — AA test passing is important. It confirms our randomization is working correctly before we even launch. 👏",
        reactions: ['🎯 3'],
    },
    {
        sender: 'pm',
        time: 'Mon 03:50 PM',
        text: "Awesome work everyone. Let's do a final pre-launch checklist and go live tomorrow morning.",
        attachment: {
            type: 'doc',
            label: '✅ Pre-Launch Checklist',
            title: 'All Systems Go',
            body: `☑ Hypothesis documented<br/>
☑ Metrics & tracking verified<br/>
☑ Sample size calculated (127K total, ~14 days)<br/>
☑ Legal / GDPR clearance confirmed<br/>
☑ Design variants approved<br/>
☑ AA test passed (p = 0.71)<br/>
☑ Kill switch ready<br/>
<br/>🟢 <b>READY TO LAUNCH</b>`,
        },
    },

    // ─── PHASE 3: Launch & Monitor ───────
    {
        type: 'phase',
        phase: 'phase3',
        label: 'Phase 3 — Launch & Monitoring',
    },
    {
        type: 'system',
        text: 'Experiment "checkout_cta_color_v1" went live — Tuesday 09:00 AM',
    },
    {
        sender: 'eng',
        time: 'Tue 09:15 AM',
        text: "🟢 Experiment is live! Traffic is splitting 50/50 as expected. Exposure events are flowing into the data warehouse. Everything looks healthy.",
        reactions: ['🚀 5', '🎉 3'],
    },
    {
        sender: 'ds',
        time: 'Tue 02:00 PM',
        text: "First-day health check: both groups have similar baseline characteristics (age, device, region). No sample ratio mismatch — we're getting exactly 50/50 split. Green light! 🟢",
        deliverableCard: {
            from: '👩‍🔬 Maya (Data Scientist)',
            name: 'Day 1 Health Check',
            desc: 'SRM test passed, balanced groups, no data anomalies',
            color: '#7c6ff7',
        },
    },
    {
        sender: 'pm',
        time: 'Day 4 - 10:00 AM',
        text: "Quick question for Maya — I can see in our dashboard that Treatment is showing +0.8% conversion rate after 4 days. Should we call it and ship now?",
    },
    {
        sender: 'ds',
        time: 'Day 4 - 10:15 AM',
        text: "NOT YET ❌ — This is really important. Even though the numbers look good, we CANNOT stop the test early. Here's why:",
        attachment: {
            type: 'alert',
            label: '⚠️ Peeking Problem Warning',
            title: "Don't Stop Early — The Peeking Problem",
            body: `Stopping an experiment early because "it looks significant" is called <b>peeking</b>, and it inflates your false positive rate dramatically.<br/><br/>
At Day 4, our p-value may look low, but our sample size is only ~40,000 users. We need ~127,000 for 80% power at our stated MDE.<br/><br/>
If we stop now: our true false positive risk could be 15–25% instead of 5%.<br/><br/>
⏰ <b>We must run until Day 14</b> (the pre-specified stopping point) regardless of interim results.`,
        },
    },
    {
        sender: 'pm',
        time: 'Day 4 - 10:22 AM',
        text: "Got it — won't peek again 😅 Lesson learned. Letting it run.",
        reactions: ['😅 2', '📚 3'],
    },
    {
        sender: 'eng',
        time: 'Day 7 - 09:00 AM',
        text: "Week 1 check-in: all systems stable. Both groups are accumulating users at expected rates. No anomalies in the logging pipeline. Conversion tracking is working perfectly.",
    },
    {
        sender: 'growth',
        time: 'Day 10 - 09:30 AM',
        text: "Getting excited — almost there! Any early indicator we can look at without it being a formal peek?",
    },
    {
        sender: 'ds',
        time: 'Day 10 - 09:45 AM',
        text: "We can look at non-primary metrics directionally — just don't make any decisions on them. Revenue per user trend looks positive too, which is a good sign. But we officially read results on Day 14. 🙏",

    },

    // ─── PHASE 4: Analysis & Decision ────
    {
        type: 'phase',
        phase: 'phase4',
        label: 'Phase 4 — Analysis & Decision',
    },
    {
        type: 'system',
        text: 'Experiment ended — Day 14. Analysis in progress.',
    },
    {
        sender: 'ds',
        time: 'Day 14 - 10:00 AM',
        text: "The experiment has concluded. Here are the full results:",
        attachment: {
            type: 'result',
            label: '📊 Experiment Results',
            title: 'Final Statistical Analysis',
            body: `<b>Sample Sizes:</b> Control: 64,230 users | Treatment: 63,891 users<br/><br/>
<b>Conversion Rates:</b><br/>
• Control (Gray): <code>5.02%</code><br/>
• Treatment (Orange): <code>5.67%</code><br/>
• Absolute Lift: <code>+0.65%</code><br/>
• Relative Lift: <code>+12.9%</code><br/><br/>
<b>Statistical Test:</b> Two-proportion Z-test (two-tailed)<br/>
• Z-statistic: <code>4.87</code><br/>
• P-value: <code>0.0000011 (&lt;&lt; 0.05)</code><br/>
• 95% CI for lift: <code>[+0.42%, +0.88%]</code><br/><br/>
<b>Secondary Metrics:</b><br/>
• Revenue per user: +8.3% (p = 0.003) ✅<br/>
• Cart abandonment: −3.1% (p = 0.041) ✅<br/><br/>
🎯 <b>STATISTICALLY SIGNIFICANT — Reject H₀</b>`,
        },
        deliverableCard: {
            from: '👩‍🔬 Maya (Data Scientist)',
            name: 'Final Results Report',
            desc: 'p < 0.05, +0.65% absolute lift, all secondary metrics positive',
            color: '#7c6ff7',
        },
    },
    {
        sender: 'ds',
        time: 'Day 14 - 10:05 AM',
        text: "To summarize in plain English: the Z-score is 4.87, which is way above our 1.96 threshold for α=0.05. The p-value of 0.0000011 means there's basically zero chance this result is due to random chance. The orange button genuinely performs better. 🟢",
        reactions: ['🎉 6', '🔥 4', '🤩 3'],
    },
    {
        sender: 'growth',
        time: 'Day 14 - 10:12 AM',
        text: "Incredible results. Let me put the business impact in perspective:",
        attachment: {
            type: 'data',
            label: '💰 Business Impact',
            title: 'Revenue Projection',
            body: `At 10K checkout page visits/day:<br/><br/>
• Additional daily conversions: <code>+65 users/day</code><br/>
• Average order value: <code>$85</code><br/>
• Estimated daily revenue lift: <code>+$5,525/day</code><br/>
• Monthly impact: <code>+~$165,000/month</code><br/>
• Annual impact: <code>+~$2,000,000/year</code><br/><br/>
💡 Engineering cost to implement: 1 engineer-day. <b>ROI is exceptional.</b>`,
        },
        deliverableCard: {
            from: '📈 Tom (Growth)',
            name: 'Business Impact Analysis',
            desc: '+$2M annual revenue projection from button color change',
            color: '#ed64a6',
        },
    },
    {
        sender: 'pm',
        time: 'Day 14 - 10:30 AM',
        text: "Alright — this is a very clear winner. I'm making the call:",
        attachment: {
            type: 'decision',
            label: '✅ SHIP DECISION',
            title: '🚀 Ship the Orange Button to 100%',
            body: `<b>Decision:</b> Roll out Treatment (orange CTA button) to 100% of users.<br/><br/>
<b>Rationale:</b><br/>
• Statistically significant result (p &lt;&lt; 0.05)<br/>
• Lift exceeds our pre-specified MDE (+0.65% vs 0.5% threshold)<br/>
• All secondary metrics moved in the right direction<br/>
• No negative effects observed<br/><br/>
<b>Next steps:</b><br/>
1. Jordan to deploy orange button to 100% — target: Thursday<br/>
2. Maya to write up experiment learnings for the team wiki<br/>
3. Monitor post-launch for 1 week to confirm effect holds<br/><br/>
📝 <i>Experiment documented in the A/B Test Log.</i>`,
        },
        deliverableCard: {
            from: '🧑‍💼 Alex (PM)',
            name: 'Ship Decision',
            desc: 'Orange button approved for 100% rollout by Thursday',
            color: '#63b3ed',
        },
        reactions: ['🚀 7', '🎉 5', '💯 4'],
    },
    {
        sender: 'eng',
        time: 'Day 14 - 10:40 AM',
        text: "On it! Will have the full rollout done by Thursday EOD. I'll also archive the experiment flag and update our internal docs. 👨‍💻",
    },
    {
        sender: 'ds',
        time: 'Day 14 - 11:00 AM',
        text: "I'll write up the retrospective and learnings doc. Key takeaway worth remembering: the peeking temptation on Day 4 was real — this is worth documenting so future experiments don't make that mistake.",
        attachment: {
            type: 'doc',
            label: '📚 Key Learnings',
            title: 'Experiment Retrospective',
            body: `✅ <b>What worked:</b><br/>
• Running AA test first caught a potential SRM issue early<br/>
• Legal was involved before launch — saved us scrambling<br/>
• Clearly pre-specified MDE made the ship decision obvious<br/><br/>
⚠️ <b>Watch out for:</b><br/>
• Peeking — even with good intentions, resist checking early<br/>
• Secondary metrics matter — they gave us extra confidence<br/><br/>
📌 <b>Reminder for next experiment:</b><br/>
• Always pre-register: metric, α, power, MDE, stop date<br/>
• Run AA test before every experiment`,
        },
        deliverableCard: {
            from: '👩‍🔬 Maya (Data Scientist)',
            name: 'Experiment Retrospective',
            desc: 'Learnings, peeking warning, best practices documented',
            color: '#7c6ff7',
        },
    },
    {
        sender: 'growth',
        time: 'Day 14 - 11:15 AM',
        text: "Amazing collaboration team 🙌 This is how A/B testing should work. From hypothesis to decision in 14 days, with full statistical rigor. Let's use this as a template for future experiments.",
        reactions: ['❤️ 8', '🙌 6'],
    },
    {
        type: 'system',
        text: '✅ Experiment Complete — Orange CTA button will be shipped Thursday. +$2M ARR projected.',
    },
];

// ═══════════════════════════════════════
// DAILY WORKFLOW GUIDE (Plain English)
// ═══════════════════════════════════════
const WORKFLOW_GUIDE = [
    {
        step: 1,
        title: 'Spot the Problem & Form a Hypothesis',
        desc: 'Someone notices a metric is underperforming (e.g., low conversion rate). They look at data, heatmaps, or user feedback and come up with an idea: "If we change X, it will improve Y." This becomes the formal hypothesis. You need to be specific: what are you changing, what metric you\'re improving, and for which users.',
        who: ['PM', 'Growth', 'Designer'],
        tip: '💡 The hypothesis must be written down BEFORE you start. No changing it mid-test.',
    },
    {
        step: 2,
        title: 'Define Metrics & Ask the Stats Question',
        desc: 'Choose your primary metric (the one that decides win/lose), secondary metrics (supporting evidence), and guardrail metrics (things that must NOT get worse). Then the data scientist translates the business question into a statistics question, chooses the right test (Z-test, T-test, etc.).',
        who: ['Data Scientist', 'PM', 'Growth'],
        tip: '💡 Avoid choosing too many primary metrics — "if everything is primary, nothing is."',
    },
    {
        step: 3,
        title: 'Power Analysis — How Long Must the Test Run?',
        desc: 'The data scientist calculates the required sample size based on: your baseline metric, the minimum lift you care about (MDE), your significance threshold (usually α=0.05), and your desired power (usually 80%). This tells you how many users and how many days the test needs to run.',
        who: ['Data Scientist'],
        tip: '💡 Never run a test without this calculation first. You might stop too early and get a meaningless result.',
    },
    {
        step: 4,
        title: 'Legal & Privacy Review',
        desc: 'Check whether the experiment touches any regulated data or disrupts consent flows. For GDPR-regulated users, make sure the experiment randomization does not affect their consent experience. This is especially critical in Europe or for experiments involving personal data.',
        who: ['Legal', 'Engineer', 'PM'],
        tip: '💡 Involve Legal early — a last-minute flag kills launch timelines.',
    },
    {
        step: 5,
        title: 'Build the Variants & Set Up Tracking',
        desc: 'Engineers implement the control and treatment variants behind a feature flag. The UX designer delivers exact specs. Engineers instrument tracking events to log who entered the experiment and what they did. An AA test is run — both groups see the same thing — to confirm the randomization is working before real data is collected.',
        who: ['Engineer', 'Designer'],
        tip: '💡 Always run an AA test. It catches randomization bugs before they corrupt your real experiment.',
    },
    {
        step: 6,
        title: 'Launch & Monitor (Don\'t Peek!)',
        desc: 'The experiment goes live. Traffic is split 50/50 (or another ratio). Engineers monitor data pipelines. Data scientists run sample ratio mismatch (SRM) checks to make sure the split is actually 50/50. The most important rule: DO NOT make decisions based on early results. Wait until your pre-specified sample size is reached.',
        who: ['Engineer', 'Data Scientist'],
        tip: '⚠️ Peeking and stopping early is the #1 mistake in A/B testing. It inflates false positive rates from 5% to 15–25%.',
    },
    {
        step: 7,
        title: 'Read Results & Make the Decision',
        desc: 'Once the pre-specified sample size is reached, the data scientist runs the final analysis: calculates the Z or T statistic, gets the p-value, checks the confidence interval. If p < 0.05, you reject the null hypothesis and declare a winner. The PM then makes the ship/no-ship decision based on the stats AND business context.',
        who: ['Data Scientist', 'PM', 'Growth'],
        tip: '💡 Statistical significance alone is not enough — the effect must also be practically meaningful (above your MDE).',
    },
    {
        step: 8,
        title: 'Ship It & Write the Retrospective',
        desc: 'The winning variant is rolled out to 100% of users. Engineers archive the experiment flag. The data scientist documents the learnings — what worked, what to watch out for — so the team improves over time. This retrospective becomes the institutional memory for future experiments.',
        who: ['Engineer', 'Data Scientist', 'PM'],
        tip: '💡 Always document even failed experiments. "We tried X and it didn\'t work" is valuable knowledge.',
    },
];
