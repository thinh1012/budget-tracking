/**
 * Authentication middleware - protect routes
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }

    // Redirect to login if not authenticated
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.redirect('/login.html');
}

/**
 * Redirect to dashboard if already logged in
 */
function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    next();
}

module.exports = {
    requireAuth,
    redirectIfAuthenticated
};
