const BOT_USER_AGENT = 'ZenaraTravelBot';

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

/**
 * Minimal robots.txt parser — handles User-agent groups and Disallow/Allow
 * directives, which is all the standard actually requires us to respect.
 * Prefers a group specifically addressed to our bot name if the site has
 * one, otherwise falls back to the wildcard (`User-agent: *`) group, which
 * is what almost every site relies on in practice.
 */
function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split('\n').map((l) => l.trim());
  const groups: Record<string, RobotsRules> = {};
  let currentAgents: string[] = [];

  for (const rawLine of lines) {
    const line = (rawLine.split('#')[0] ?? '').trim();
    if (!line) continue;
    const [directiveRaw, ...rest] = line.split(':');
    const directive = (directiveRaw ?? '').trim().toLowerCase();
    const value = rest.join(':').trim();

    if (directive === 'user-agent') {
      const firstAgent = currentAgents[0];
      const lastWasAgentLine =
        currentAgents.length > 0 && firstAgent !== undefined && !groups[firstAgent]?.disallow.length && !groups[firstAgent]?.allow.length;
      if (!lastWasAgentLine) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      for (const agent of currentAgents) groups[agent] ??= { disallow: [], allow: [] };
    } else if (directive === 'disallow' && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        const group = (groups[agent] ??= { disallow: [], allow: [] });
        if (value) group.disallow.push(value);
      }
    } else if (directive === 'allow' && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        const group = (groups[agent] ??= { disallow: [], allow: [] });
        if (value) group.allow.push(value);
      }
    }
  }

  return groups[BOT_USER_AGENT.toLowerCase()] ?? groups['*'] ?? { disallow: [], allow: [] };
}

/**
 * Fetches and evaluates robots.txt for the given URL. Fails OPEN on network
 * errors (no robots.txt, or it's unreachable) — the overwhelming majority of
 * sites don't restrict anything and treating "we couldn't check" as "assume
 * blocked" would make the feature unusable against perfectly permissive
 * sites. It fails CLOSED only on an explicit matching Disallow rule.
 */
export async function isUrlAllowedByRobots(url: URL): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', url.origin);
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': `${BOT_USER_AGENT}/1.0` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true; // no robots.txt, or it 404s — nothing to respect
    const text = await res.text();
    const rules = parseRobotsTxt(text);

    const path = url.pathname + url.search;
    const isDisallowed = rules.disallow.some((rule) => rule && path.startsWith(rule));
    const isExplicitlyAllowed = rules.allow.some((rule) => rule && path.startsWith(rule));
    if (isDisallowed && isExplicitlyAllowed) {
      const disallowMatch = rules.disallow.find((rule) => path.startsWith(rule)) ?? '';
      const allowMatch = rules.allow.find((rule) => path.startsWith(rule)) ?? '';
      return allowMatch.length >= disallowMatch.length;
    }
    return !isDisallowed;
  } catch {
    return true; // couldn't fetch/parse robots.txt — fail open, see note above
  }
}

export { BOT_USER_AGENT };
