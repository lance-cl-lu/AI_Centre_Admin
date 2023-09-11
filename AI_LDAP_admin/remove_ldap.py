from ldap3 import Server, Connection

def connectLDAP():
    server = Server('ldap://120.126.23.245:31979')
    conn = Connection(server, user='cn=admin,dc=example,dc=org', password='Not@SecurePassw0rd', auto_bind=True)
    return conn


conn = connectLDAP()
# remove all posixAccount, posixGroup from ldap
conn.search('dc=example,dc=com', '(objectclass=posixAccount)')
for entry in conn.entries:
    conn.delete(entry.entry_dn)
    print('remove ' + entry.entry_dn)
conn.search('dc=example,dc=com', '(objectclass=posixGroup)')
for entry in conn.entries:
    conn.delete(entry.entry_dn)
# remove all lab from ldap
