# Requirements
* nodejs = v18.19.1


# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

# Available Scripts

In the project directory, you can run:

### `nodejs --version`
Check Node.js version — currently v18.19.1.

### `npm i`
Install Modules.

### `npm version`
Check Node.js version — currently v18.19.1.

| Key                        | Version             |
|-----------------------------|---------------------|
| CGU_AI_LDAP_admin_frontend  | 0.3.0               |
| npm                        | 9.2.0               |
| node                       | 18.19.1             |
| acorn                      | 8.8.1               |
| ada                        | 2.7.2               |
| ares                       | 1.27.0              |
| base64                     | 0.5.0               |
| brotli                     | 1.1.0               |
| cjs_module_lexer           | 1.2.3               |
| cldr                       | 44.1                |
| icu                        | 74.2                |
| llhttp                     | 6.1.0               |
| modules                    | 109                 |
| napi                       | 9                   |
| nghttp2                    | 1.59.0              |
| openssl                    | 3.0.13              |
| simdutf                    | 3.2.18              |
| tz                         | 2023c               |
| unicode                    | 15.1                |
| uv                         | 1.48.0              |
| uvwasi                     | 0.0.19              |
| v8                         | 10.2.154.26-node.28 |
| zlib                       | 1.3                 |

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

#### `output`
```
drwxrwxr-x 4 lance lance 4096 Jun 18 14:52 .
drwxrwxr-x 3 lance lance 4096 Jun 18 19:14 ..
drwxrwxr-x 2 lance lance 4096 Jun 18 14:52 css
drwxrwxr-x 2 lance lance 4096 Jun 18 14:52 js

static/static/css:
total 788
drwxrwxr-x 2 lance lance   4096 Jun 18 14:52 .
drwxrwxr-x 4 lance lance   4096 Jun 18 14:52 ..
-rwxrwxr-x 1 lance lance 238697 Jun 18 14:52 main.5bd7cccf.css
-rwxrwxr-x 1 lance lance 554414 Jun 18 14:52 main.5bd7cccf.css.map

static/static/js:
total 4792
drwxrwxr-x 2 lance lance    4096 Jun 18 14:52 .
drwxrwxr-x 4 lance lance    4096 Jun 18 14:52 ..
-rwxrwxr-x 1 lance lance  850255 Jun 18 14:52 main.b860cdae.js
-rwxrwxr-x 1 lance lance    2715 Jun 18 14:52 main.b860cdae.js.LICENSE.txt
-rwxrwxr-x 1 lance lance 4040770 Jun 18 14:52 main.b860cdae.js.map
```

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

 ![image](https://github.com/JaeggerJose/AI_Centre_Admin/blob/main/assets/ports.jpg?raw=true)

 ![image](https://github.com/JaeggerJose/AI_Centre_Admin/blob/main/assets/browser.jpg?raw=true)

# Architecture

#### index.html

- **`%PUBLIC_URL%`** is a placeholder specific to Create React App (CRA).  
  It will be replaced with `/` or the homepage path you configure during build.  
  Suitable for pure frontend React projects.  

- **`{% static %}`** is a Django template tag.  
  It must be configured through Django's `STATICFILES_DIRS` or `collectstatic`.  
  Suitable for Django + React hybrid architecture (where Django serves static files).  

#### App.js (Route Table)
```
                  <Routes>
                    <Route exact path="/" element={<Home />} />
                    <Route path='password' element={<Password />}/>
                    <Route path="about/" element={<About />} />
                    <Route path="add/" element={<Add />} />
                    <Route path='lab/import' element={<LabImport/>}/>
                    <Route path="add/lab" element={<AddLab />} />
                    <Route path="add/user" element={<AddUser />} />
                    <Route path="add/admin" element={<AddAdmin />} />
                    <Route path="add/excel" element={<AddExcel />} />
                    <Route path="login" element={<Login />} />
                    <Route path="lab" element={<Lab />} />
                    <Route path="user" element={<User />} />
                    <Route path="/insert" element={<Insert/>}/>
                    <Route path="/listnotebook" element={<ListNoteBook/>}/>
                    <Route path="/edit/group" element={<EditGroup/>}/>
                    <Route path="move/" element={<Move/>}/>
                    <Route path="*" element={<Home />} />
                  </Routes>
```

#### User.js (Get data from backend)
```
    ...

    useEffect(() => {
        getuserinfo();
    }, [state]);
    
    ...

    let getuserinfo = async () => {
        document.getElementsByClassName('userPage')[0].style.opacity = 0;

        fetch('/api/ldap/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        ...
    }
    ...
```

#### User.js (Render to front)
```
    return (
        <div className='userPage'>
                <h1>User {state && state.user}</h1><br/>
                <Form className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px", 

        ...

        </div>

    )
```

#### User.js (post to backend)
```
            //saveUser();
            let response = await fetch('/api/user/change/', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username": document.getElementById("inputUsername").value,
                    "firstname": document.getElementById("inputFirstName").value,
                    "lastname": document.getElementById("inputLastName").value,
                    "email": document.getElementById("inputEmail").value,
                    "cpu_quota": document.getElementById("cpuQuota").value,
                    "mem_quota": document.getElementById("memQuota").value,
                    "gpu_quota": document.getElementById("gpuQuota").value,
                    "permission": saveUser(),
                }),
            });
```

# Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
