import Tree from 'react-animated-tree'
import { useContext, useEffect } from 'react';
import AuthContext from '../../context/AuthContext';
import { AuthProvider } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';
function TreeView() {
    let {userlist, getUserList} = useContext(AuthContext);
    useEffect(() => {
        getUserList();
    }, []);
    
    return (
        <div className='tree'>
            <AuthProvider>
                <Card>
                    <Card.Header>Tree View</Card.Header>
                    {userlist && userlist.map((user, index) => (
                        <Tree content={<Link to="/lab" state={{ "lab": user.group_dn }}>{user.group_dn}</Link>} type="Lab" key={index}>
                            {user.member_uids.map((memberUid, index) => (
                                <Tree content={<Link to="/user" state={{ "user": memberUid }}>{memberUid}</Link>} type="User" key={index}/>
                            ))}
                        </Tree>
                    ))}
                </Card>
            </AuthProvider>
        </div>
    );
}
export default TreeView;