newspull
========

Pull requests for news. 


### API (draft)

Documents:
    
    story { 'title': '', 'tagline': '', 'slug': '', 'grafs': [<graf>, ..], 'author': 'arc64', 'created': ISODate() }
    graf { 'placeholder': t|f, 'text': '...', 'author': 'arc64', 'id': 'xxxx', 'index': 3, 'approved': ISODate(), 'vip': t|f }

* GET ``/api/stories``
* GET ``/api/stories/<slug>`` 
* POST ``/api/stories/<slug>/graf``
