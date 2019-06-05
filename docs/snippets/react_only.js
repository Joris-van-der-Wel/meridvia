/*
This example demonstrates how this library could be used to fetch and
display the details of a "user account" using the react
lifecycle methods componentDidMount, componentWillUnmount,
componentDidUpdate and then store the result in the react component
state.

This example includes:
* A fake API which pretends to fetch details of a user
  account using a http request
* A meridvia resource manager on which we register a resource for
  the user account details
* A react component which lets the resource manager know which
  resources it needs using a meridvia session and stores the result
* Some logging to demonstrate what is going on

This is a trivial example to demonstrate one way to integrate this
library with react. It has been kept simple on purpose, however the
strength of this library becomes most apparent in more complex code
bases, for example: When the same resource is used in multiple
places in the code base; When resources should be cached; When data
has to be refreshed periodically; Et cetera.
*/

const {Component, createElement} = require('react');
const ReactDOM = require('react-dom');
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

const setupResourceManager = () => {
    // Set the `dispatch` callback so that the return value of
    // the "fetch" callback (a promise that will resolve to the
    // api result) is returned as-is from the request function during
    // the session.
    // (The library will cache this value as appropriate).
    const dispatcher = value => value;
    const resourceManager = createManager(dispatcher, {
        // Because we are using promises during the transaction, it is
        // possible that the transactions might overlap. Normally this
        // is not allowed. By setting this option to true, the
        // older transaction will be aborted instead.
        allowTransactionAbort: true,
    });

    resourceManager.resource({
        name: 'userDetails',
        fetch: async (params) => {
            console.log('Resource userDetails: fetch', params);
            const {userId} = params;
            const result = await myApi.userDetails(userId);
            return result;
        },
    });

    return resourceManager;
};

class Hello extends Component {
    constructor(props) {
        super(props);
        this.state = {user: null};
    }

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
        this.session(async request => {
            const user = await request('userDetails', {
                userId: this.props.userId,
            });

            if (user !== this.state.user) {
                this.setState({user});
            }
        });
    }

    render() {
        const {user} = this.state;
        return createElement('div', {className: 'Hello'},
            user ? `Hello ${user.name}` : 'Loading...'
        );
        /* If you prefer JSX, this is what it would look like:
        return <div className="Hello">
            {user ? `Hello ${user.name}` : 'Loading...'}
        </div>
        */
    }
}

const example = () => {
    const resourceManager = setupResourceManager();

    // Create the container element used by react:
    const container = document.createElement('div');
    document.body.appendChild(container);

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
        const element = createElement(Hello, {resourceManager, userId}, null);

        /* If you prefer JSX, this is what it would look like:
        const element = (
            <Hello resourceManager={resourceManager} userId={userId} />
        );
        */
        ReactDOM.render(element, container);
    };

    console.log('First render...');
    renderMyApp(4);

    setTimeout(() => {
        console.log('Second render...');
        renderMyApp(5);
    }, 100);
};

example();
