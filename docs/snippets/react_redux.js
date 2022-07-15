/*
This example demonstrates how this library could be used to fetch and
display the details of a "user account" using redux and the react
lifecycle methods componentDidMount, componentWillUnmount and
componentDidUpdate.

This example includes:
* A fake API which pretends to fetch details of a user
  account using a http request
* A redux store which stores the user account details
* A reducer for the redux store that handles fetch and clear
  actions for the details of a specific user account
* A meridvia resource manager on which we register a resource for
  the user account details
* A react component which lets the resource manager know which
  resources it needs using a meridvia session.
* A react-redux container which passes the user details from the
  state store to the component.
* Some logging to demonstrate what is going on

This is a trivial example to demonstrate one way to integrate this
library with react and redux. It has been kept simple on purpose,
however the strength of this library becomes most apparent in more
complex code bases, for example: When the same resource is used in
multiple places in the code base; When resources should be cached;
When data has to be refreshed periodically; Et cetera.
*/

const {Component, createElement} = require('react');
const {createRoot} = require('react-dom/client');
const {createStore, combineReducers, applyMiddleware} = require('redux');
const {Provider: ReduxProvider, connect} = require('react-redux');
const {default: promiseMiddleware} = require('redux-promise');
const {createManager} = require('meridvia');

const myApi = {
    // Perform a http request to fetch the user details for the
    // given userId
    userDetails: async (userId) => {
        // This is where we would normally perform a real http
        // request. For example:
        //   const response = await fetch(`/user/${encodeURIComponent(userId)}`);
        //   if (!response.ok) {
        //     throw Error(`Request failed: ${response.status}`);
        //   }
        //   return await response.json();
        // however to keep this example simple, we only pretend.
        await new Promise(resolve => setTimeout(resolve, 10));
        if (userId === 4) {
            return {name: 'Jack O\'Neill', email: 'jack@example.com'};
        }
        else if (userId === 5) {
            return {name: 'Isaac Clarke', email: 'iclarke@unitology.gov'};
        }
        throw Error(`Unknown userId ${userId}`);
    },
};

// In the state store, userDetailsById contains the
// details of a user, indexed by the userId:
//   userDetailsById[userId] = {name: ..., email: ...}
const userDetailsByIdReducer = (state = {}, action) => {
    if (action.type === 'FETCH_USER_DETAILS') {
        // In this example we only store the resolved
        // value of the api call. However you could also
        // store an error message if the api call fails,
        // or an explicit flag to indicate an api call is
        // in progress.
        const newState = Object.assign({}, state);
        newState[action.userId] = action.result;
        return newState;
    }
    else if (action.type === 'CLEAR_USER_DETAILS') {
        // Completely remove the data from the state store.
        // `delete` must be used to avoid memory leaks.
        const newState = Object.assign({}, state);
        delete newState[action.userId];
        return newState;
    }
    return state;
};

// The reducer used by our redux store
const rootReducer = combineReducers({
    userDetailsById: userDetailsByIdReducer,
});

const setupResourceManager = (dispatch) => {
    // The resource manager will pass on the return value of `fetch`
    // and `clear` to the `dispatch` callback here
    const resourceManager = createManager(dispatch);

    resourceManager.resource({
        name: 'userDetails',
        fetch: async (params) => {
            // This function returns a promise. In this example
            // we are using the redux-promise middleware. Which
            // will resolve the promise before passing the action
            // on to our reducers.

            console.log('Resource userDetails: fetch', params);
            const {userId} = params;
            const result = await myApi.userDetails(userId);
            return {
                type: 'FETCH_USER_DETAILS',
                userId,
                result,
            };
        },
        clear: (params) => {
            console.log('Resource userDetails: clear', params);
            const {userId} = params;
            return {
                type: 'CLEAR_USER_DETAILS',
                userId,
            };
        },
    });

    return resourceManager;
};

class Hello extends Component {
    componentDidMount() {
        console.log('<Hello/> componentDidMount');
        // Component is now present in the DOM. Create a new
        // meridvia session which will represent the resources
        // in use by this component. The resource manager will
        // combine the state of all active sessions to make
        // its decisions.
        this.session = this.props.resourceManager.createSession();
        this.updateResources();
    }
    componentWillUnmount() {
        console.log('<Hello/> componentWillUnmount');
        // The component is going to be removed from the DOM.
        // Destroy the meridvia session to indicate that we
        // no longer need any resources. Attempting to use
        // the session again will result in an error.
        this.session.destroy();
    }
    componentDidUpdate() {
        console.log('<Hello/> componentDidUpdate');
        // The props have changed.
        // In this example the specific resource that we need is based
        // on the "userId" prop, so we have to update our meridvia
        // session
        this.updateResources();
    }

    updateResources() {
        this.session(request => {
            request('userDetails', {userId: this.props.userId});
        });
    }

    render() {
        const {user} = this.props;
        return createElement('div', {className: 'Hello'},
            user ? `Hello ${user.name}` : 'Loading...',
        );
        /* If you prefer JSX, this is what it would look like:
        return <div className="Hello">
            {user ? `Hello ${user.name}` : 'Loading...'}
        </div>
        */
    }
}
// A react-redux container component
const HelloContainer = connect((state, props) => ({
    user: state.userDetailsById[props.userId],
}))(Hello);


const example = () => {
    const store = createStore(rootReducer, applyMiddleware(promiseMiddleware));
    const resourceManager = setupResourceManager(store.dispatch);

    // Create the container element used by react:
    const container = document.createElement('div');
    document.body.appendChild(container);
    const reactRoot = createRoot(container);

    // create a DOM MutationObserver so that we can log
    // what the effects of the rendering are during this example
    const observer = new MutationObserver(() => {
        console.log('Render result:', container.innerHTML);/* begin_hidden */
        const expectedHtml = '<div class="Hello">Hello Isaac Clarke</div>';
        if (container.innerHTML === expectedHtml) {
            console.log('Hidden end of example');
        }
        /* end_hidden */
    });
    observer.observe(container, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    });

    const renderMyApp = userId => {
        const element = createElement(ReduxProvider, {store},
            createElement(HelloContainer, {resourceManager, userId}, null),
        );
        /* If you prefer JSX, this is what it would look like:
        const element = <ReduxProvider store={store}>
            <HelloContainer resourceManager={resourceManager} userId={userId} />
        </ReduxProvider>
        */
        reactRoot.render(element);
    };

    console.log('First render...');
    renderMyApp(4);

    setTimeout(() => {
        console.log('Second render...');
        renderMyApp(5);
    }, 100);
};

example();
