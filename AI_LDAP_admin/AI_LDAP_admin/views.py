from django.shortcuts import render

from django.http import HttpResponse

from . import urls

def home(request):
    return render(request,"index.html")
