import React, { useContext, useEffect } from 'react';
import Tree from 'react-animated-tree';
import { Link } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { AuthProvider } from '../../context/AuthContext';
import { FaFolder, FaUser, FaPlusSquare, FaMinusSquare } from 'react-icons/fa';
import './Tree.css';

// 自訂節點元件：根據類型顯示不同圖示與標籤
const NodeItem = ({ type, label, linkTo, linkState }) => {
  const IconComponent = type === 'group' ? FaFolder : FaUser;
  return (
    <Link 
      to={linkTo} 
      state={linkState}
      style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        color: '#242424',
      }}
    >
      <IconComponent style={{ marginRight: '8px' }} />
      <span>{label}</span>
    </Link>
  );
};

const TreeView = () => {
  const { userlist, getUserList } = useContext(AuthContext);

  useEffect(() => {
    getUserList();
  }, [getUserList]);

  return (
    <div className="tree">
      <AuthProvider>
        <div className="TreeStyle" style={{ fontFamily: 'Segoe UI', padding: '10px', margin: '10px' }}>
          {userlist && userlist.map((user, index) => (
            <Tree
              key={index}
              content={
                <NodeItem 
                  type="group"
                  label={user.group_dn}
                  linkTo="/lab"
                  linkState={{ lab: user.group_dn }}
                />
              }
              // 用自訂圖示覆蓋預設箭頭：展開時顯示 FaMinusSquare，收合時顯示 FaPlusSquare
              openIcon={<FaMinusSquare style={{ marginRight: '8px' }} />}
              closedIcon={<FaPlusSquare style={{ marginRight: '8px' }} />}
            >
              {user.member_uids.map((memberUid, idx) => (
                <Tree
                  key={idx}
                  content={
                    <NodeItem 
                      type="user"
                      label={memberUid}
                      linkTo="/user"
                      linkState={{ user: memberUid }}
                    />
                  }
                />
              ))}
            </Tree>
          ))}
        </div>
      </AuthProvider>
    </div>
  );
};

export default TreeView;