import { allPosts } from 'content-collections';

export async function load() {
	const limitedPosts = allPosts
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 3)
		.map(post => ({
			title: post.title,
			slug: post.slug,
			date: post.date,
			readTime: post.readTime
		}));

	return {
		posts: limitedPosts
	};
}