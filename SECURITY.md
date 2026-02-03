# Security Best Practices

## Repository Security

### Branch Protection (Requires GitHub Pro)

Branch protection rules are not available for private repositories on GitHub Free. To enable branch protection:

1. **Upgrade to GitHub Pro** ($4/month per user)
2. Or **Make repository public** (not recommended for proprietary code)

### Alternative Security Measures

Since branch protection is unavailable, follow these practices:

#### 1. **Manual Review Process**
- Always review changes before pushing to `main`
- Use feature branches for all development work
- Create pull requests even if you're the only developer
- Document all major changes in commit messages

#### 2. **Local Git Hooks**

Create a pre-push hook to prevent accidental force pushes:

```bash
# Create the hook file
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ $current_branch = $protected_branch ]; then
    read -p "You're about to push to main. Are you sure? [y/n] " -n 1 -r < /dev/tty
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
    echo "Push aborted."
    exit 1
fi
EOF

# Make it executable
chmod +x .git/hooks/pre-push
```

#### 3. **Backup Strategy**
- Keep regular backups of the repository
- Use GitHub's download archive feature periodically
- Maintain local copies on multiple machines
- Consider using GitHub Actions for automated backups

#### 4. **Access Control**
- Limit repository collaborators to trusted team members only
- Use GitHub's collaborator permissions (Read, Write, Admin)
- Regularly audit who has access to the repository
- Remove access for team members who leave the project

#### 5. **Commit Signing**

Sign your commits with GPG to verify authenticity:

```bash
# Generate GPG key
gpg --full-generate-key

# List keys
gpg --list-secret-keys --keyid-format=long

# Configure Git to use your key
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# Add GPG key to GitHub
gpg --armor --export YOUR_KEY_ID
# Copy output and add to GitHub Settings → SSH and GPG keys
```

#### 6. **Environment Security**
- Never commit `.env` files
- Use `.gitignore` to exclude sensitive files
- Rotate secrets regularly
- Use different credentials for dev/staging/production

#### 7. **Code Review Checklist**

Before pushing to main, verify:
- [ ] All tests pass (`pnpm test`)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
- [ ] No sensitive data in commits
- [ ] Commit messages are clear and descriptive
- [ ] Changes are documented in README if needed
- [ ] Dependencies are up to date and secure

## Vulnerability Management

### Dependency Scanning

Run regular security audits:

```bash
# Check for vulnerabilities
pnpm audit

# Fix vulnerabilities automatically
pnpm audit --fix

# Update dependencies
pnpm update
```

### GitHub Security Features

Enable these free GitHub security features:

1. **Dependabot Alerts**
   - Go to Settings → Security & analysis
   - Enable "Dependabot alerts"
   - Enable "Dependabot security updates"

2. **Secret Scanning**
   - Automatically enabled for public repos
   - Detects accidentally committed secrets

3. **Code Scanning**
   - Set up GitHub Actions for CodeQL analysis
   - Scans for security vulnerabilities in code

## Incident Response

### If Secrets Are Compromised

1. **Immediately rotate all affected credentials**
2. **Remove secrets from Git history** using `git filter-branch` or BFG Repo-Cleaner
3. **Force push the cleaned history** (coordinate with team first)
4. **Audit access logs** to check for unauthorized access
5. **Document the incident** and update security procedures

### If Repository Is Compromised

1. **Change GitHub password immediately**
2. **Enable two-factor authentication** if not already enabled
3. **Review repository access logs**
4. **Check for unauthorized commits or changes**
5. **Notify all collaborators**
6. **Consider creating a new repository** if compromise is severe

## Compliance

### Data Protection

- No personal data should be committed to the repository
- User data is stored only in the database
- Follow GDPR/data protection guidelines
- Regular data backups are maintained

### Audit Trail

- All commits are logged with author and timestamp
- Database audit logs track all data changes
- Application logs are retained for 90 days
- Access logs are monitored for suspicious activity

## Security Contacts

**Security Issues**: kezieokpala@gmail.com  
**Project Manager**: Kezie Okpala  
**Organization**: Nigerian Red Cross Society

## Reporting Security Vulnerabilities

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Email details to kezieokpala@gmail.com
3. Include steps to reproduce the issue
4. Allow 48 hours for initial response
5. Coordinate disclosure timeline

---

**Last Updated**: February 2026  
**Review Schedule**: Quarterly
