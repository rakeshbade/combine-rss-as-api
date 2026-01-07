const Bytez = require("bytez.js");
const { applicationLogger: LOG } = require("./logger");

const AI_FILTER_ENABLED = process.env.ENABLE_AI_FILTER === 'true';
const key = process.env.BYTEZ_API_KEY;

let sdk = null;
let model = null;

// Initialize SDK only if AI filtering is enabled and key is provided
if (AI_FILTER_ENABLED && key) {
  sdk = new Bytez(key);
  model = sdk.model("openai/gpt-oss-20b");
  LOG.info("AI filtering enabled with Bytez SDK");
} else {
  LOG.info("AI filtering disabled");
}

// Cache for AI responses to avoid repeated calls for similar content
const filterCache = new Map();
const CACHE_SIZE_LIMIT = 500;

/**
 * Use AI to determine if a post is related to class action lawsuits or legal investigations
 * @param {Object} post - The post object with title and description
 * @returns {Promise<boolean>} - Returns true if post should be filtered out (is legal/class action)
 */
const isLegalOrClassActionPost = async (post) => {
  if (!AI_FILTER_ENABLED || !model) return false;
  if (!post || !post.title) return false;

  const content = `${post.title} ${post.description || ""}`.substring(0, 500);
  const cacheKey = content.substring(0, 100);

  // Check cache first
  if (filterCache.has(cacheKey)) {
    return filterCache.get(cacheKey);
  }

  try {
    const prompt = `You are a news classification system. Analyze this news headline and description and determine if it is related to:
- Class action lawsuits
- Legal investigations
- Securities fraud cases
- Shareholder litigation
- Law firm announcements about investor rights
- Deadline alerts for legal claims

News: "${content}"

Respond with ONLY "YES" if it's related to any of the above legal/class action topics, or "NO" if it's not.`;

    const { error, output } = await model.run([
      {
        role: "user",
        content: prompt,
      },
    ]);

    if (error) {
      LOG.error("AI Filter Error:", error);
      // Default to false (don't filter) if AI fails
      return false;
    }

    const response = output?.trim().toUpperCase();
    const shouldFilter = response === "YES";

    // Update cache
    if (filterCache.size >= CACHE_SIZE_LIMIT) {
      const firstKey = filterCache.keys().next().value;
      filterCache.delete(firstKey);
    }
    filterCache.set(cacheKey, shouldFilter);

    if (shouldFilter) {
      LOG.info(`AI filtered out legal post: ${post.title.substring(0, 80)}...`);
    }

    return shouldFilter;
  } catch (error) {
    LOG.error("AI Filter Exception:", error);
    // Default to false (don't filter) if AI fails
    return false;
  }
};

/**
 * Batch filter posts using AI
 * @param {Array} posts - Array of posts to filter
 * @returns {Promise<Array>} - Filtered array with legal/class action posts removed
 */
const filterPostsWithAI = async (posts, enableAI = false) => {
  // Check both environment variable and per-request flag
  const shouldFilter = (AI_FILTER_ENABLED || enableAI) && model;
  if (!shouldFilter) return posts;
  if (!posts || !posts.length) return posts;

  const filterResults = await Promise.all(
    posts.map(async (post) => {
      const shouldFilter = await isLegalOrClassActionPost(post);
      return { post, shouldFilter };
    })
  );

  return filterResults
    .filter(({ shouldFilter }) => !shouldFilter)
    .map(({ post }) => post);
};

module.exports = {
  isLegalOrClassActionPost,
  filterPostsWithAI,
};
